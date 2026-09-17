package com.routine.reminder;

import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NotificationLogRepository extends JpaRepository<NotificationLog, UUID> {

    Page<NotificationLog> findByUserIdOrderByProcessedAtDesc(UUID userId, Pageable pageable);

    List<NotificationLog> findByReminderId(UUID reminderId);
}
