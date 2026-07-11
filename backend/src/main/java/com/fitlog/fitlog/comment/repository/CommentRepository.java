package com.fitlog.fitlog.comment.repository;

import com.fitlog.fitlog.comment.entity.Comment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface CommentRepository extends JpaRepository<Comment, Long> {

    @Query("SELECT c FROM Comment c JOIN FETCH c.author WHERE c.id = :id")
    Optional<Comment> findByIdWithAuthor(@Param("id") Long id);

    @Query("SELECT c FROM Comment c JOIN FETCH c.author WHERE c.targetType = :type AND c.targetId = :id AND c.deletedAt IS NULL ORDER BY c.createdAt ASC")
    List<Comment> findByTargetTypeAndTargetIdAndDeletedAtIsNullOrderByCreatedAtAsc(@Param("type") String targetType, @Param("id") Long targetId);

    @Query("SELECT c FROM Comment c JOIN FETCH c.author WHERE c.targetType = :type AND c.trainerId = :trainerId AND c.memberId = :memberId AND c.targetDate = :date AND c.deletedAt IS NULL ORDER BY c.createdAt ASC")
    List<Comment> findDietDayComments(@Param("type") String targetType, @Param("trainerId") Long trainerId, @Param("memberId") Long memberId, @Param("date") LocalDate date);
}
