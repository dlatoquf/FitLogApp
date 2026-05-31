package com.fitlog.fitlog.bodylog.repository;

import com.fitlog.fitlog.bodylog.entity.ManualBodyLog;
import com.fitlog.fitlog.trainer.entity.ManualMember;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ManualBodyLogRepository extends JpaRepository<ManualBodyLog, Long> {
    List<ManualBodyLog> findByManualMemberOrderByLogDateAsc(ManualMember manualMember);
}
