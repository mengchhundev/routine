package com.routine.note;

import com.routine.common.Auditable;
import jakarta.persistence.*;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** One reflection per user per local day (enforced by a unique index). */
@Entity
@Table(name = "daily_reviews")
@Getter
@Setter
@NoArgsConstructor
public class DailyReview extends Auditable {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "review_date", nullable = false)
    private LocalDate reviewDate;

    @Column(columnDefinition = "text")
    private String summary;

    @Column(name = "what_went_well", columnDefinition = "text")
    private String whatWentWell;

    @Column(name = "what_went_wrong", columnDefinition = "text")
    private String whatWentWrong;

    @Column(name = "what_to_improve", columnDefinition = "text")
    private String whatToImprove;

    /** All 1-5, all optional: a review with only free text is still a review. */
    private Short rating;

    private Short mood;

    private Short energy;
}
