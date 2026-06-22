package com.fitlog.fitlog.bodylog.repository;

import com.fitlog.fitlog.bodylog.entity.ManualBodyLog;
import com.fitlog.fitlog.trainer.entity.ManualMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

public interface ManualBodyLogRepository extends JpaRepository<ManualBodyLog, Long> {
    List<ManualBodyLog> findByManualMemberOrderByLogDateAsc(ManualMember manualMember);

    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = "DELETE FROM manual_body_logs WHERE manual_member_id = :manualMemberId", nativeQuery = true)
    void deleteByManualMemberId(@Param("manualMemberId") Long manualMemberId);
}
