package com.routine.reminder;

import com.routine.user.User;
import com.routine.user.UserRepository;
import com.routine.user.UserSettings;
import com.routine.user.UserSettingsRepository;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * The transactional half of reminder delivery. Separate from
 * {@link ReminderDispatcher} because Spring's {@code @Transactional} works
 * through a proxy: a scheduled method calling its own transactional method
 * would bypass it entirely and run the whole batch outside a transaction.
 *
 * <p><b>What stops a double send.</b> Not the claim query's lock — that is
 * released when the claim transaction commits, before anything is delivered.
 * It is the partial unique index on {@code notification_log (reminder_id)
 * WHERE outcome = 'SENT'}: two workers may both decide to send, but only one
 * can record having done so, and the loser rolls its own delivery back.
 */
@Service
public class ReminderDelivery {

    private static final Logger log = LoggerFactory.getLogger(ReminderDelivery.class);

    private final ReminderRepository reminders;
    private final NotificationLogRepository notifications;
    private final UserRepository users;
    private final UserSettingsRepository settings;
    private final Map<ReminderChannel, NotificationSender> senders;
    private final ReminderProperties properties;

    public ReminderDelivery(ReminderRepository reminders,
                            NotificationLogRepository notifications,
                            UserRepository users,
                            UserSettingsRepository settings,
                            List<NotificationSender> senders,
                            ReminderProperties properties) {
        this.reminders = reminders;
        this.notifications = notifications;
        this.users = users;
        this.settings = settings;
        this.senders = senders.stream().collect(Collectors.toMap(
                NotificationSender::channel, Function.identity(), (first, second) -> first));
        this.properties = properties;
    }

    /** Ids only: the entities are re-read inside each delivery's own transaction. */
    @Transactional
    public List<UUID> claimDue() {
        return reminders.claimDue(Instant.now(), PageRequest.of(0, properties.batchSize()))
                .stream().map(Reminder::getId).toList();
    }

    /**
     * Delivers one reminder in its own transaction, so a single failure cannot
     * roll back the deliveries either side of it.
     *
     * @return whether the reminder was delivered on this attempt
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean deliver(UUID reminderId) {
        Reminder reminder = reminders.findById(reminderId).orElse(null);
        if (reminder == null || reminder.getStatus() != ReminderStatus.PENDING) {
            return false;
        }

        Optional<User> owner = users.findById(reminder.getUserId());
        if (owner.isEmpty()) {
            reminder.setStatus(ReminderStatus.CANCELLED);
            return false;
        }
        User user = owner.get();

        // Too late to be useful. Cancelled rather than sent, so the user is told
        // it was missed rather than being pinged at midnight about the morning.
        if (reminder.getReminderTime().isBefore(Instant.now().minus(properties.graceWindow()))) {
            reminder.setStatus(ReminderStatus.CANCELLED);
            reminder.setLastError("Missed its window and was not delivered.");
            return false;
        }

        UserSettings preferences = settings.findById(user.getId())
                .orElseGet(() -> UserSettings.defaultsFor(user.getId()));

        if (!preferences.isRemindersEnabled()) {
            reminder.setStatus(ReminderStatus.CANCELLED);
            reminder.setLastError("Reminders are switched off in your settings.");
            return false;
        }

        // Honour the preference over the reminder's own channel: somebody who
        // turned email off should still get the in-app one, not nothing.
        ReminderChannel channel =
                reminder.getChannel() == ReminderChannel.EMAIL && !preferences.isEmailReminders()
                        ? ReminderChannel.IN_APP
                        : reminder.getChannel();

        NotificationSender sender = senders.getOrDefault(channel, senders.get(ReminderChannel.IN_APP));
        if (sender == null) {
            log.error("No notification sender is configured; reminder {} cannot be delivered", reminderId);
            return false;
        }

        String text = textOf(reminder);
        reminder.setAttempts((short) (reminder.getAttempts() + 1));

        try {
            sender.send(user, reminder, text);
            record(reminder, channel, "SENT", text);

            reminder.setStatus(ReminderStatus.SENT);
            reminder.setSentAt(Instant.now());
            reminder.setLastError(null);
            return true;
        } catch (DataIntegrityViolationException alreadySent) {
            // Another worker logged the send first. Its delivery stands; this
            // transaction must not also mark the reminder or the row would be
            // written twice.
            throw alreadySent;
        } catch (Exception ex) {
            reminder.setLastError(ex.getMessage());
            if (reminder.getAttempts() >= properties.maxAttempts()) {
                reminder.setStatus(ReminderStatus.FAILED);
                record(reminder, channel, "FAILED", ex.getMessage());
            }
            // Below the ceiling it stays PENDING and the next poll retries it.
            log.warn("Reminder {} delivery failed (attempt {})",
                    reminderId, reminder.getAttempts(), ex);
            return false;
        }
    }

    private void record(Reminder reminder, ReminderChannel channel, String outcome, String detail) {
        NotificationLog entry = new NotificationLog();
        entry.setReminderId(reminder.getId());
        entry.setUserId(reminder.getUserId());
        entry.setChannel(channel.name());
        entry.setOutcome(outcome);
        entry.setDetail(detail);
        // Flushed now rather than at commit, so a duplicate SENT row is caught
        // here — while there is still a chance to abandon this delivery.
        notifications.saveAndFlush(entry);
    }

    private String textOf(Reminder reminder) {
        return reminder.getMessage() != null && !reminder.getMessage().isBlank()
                ? reminder.getMessage()
                : "You have something scheduled.";
    }
}
