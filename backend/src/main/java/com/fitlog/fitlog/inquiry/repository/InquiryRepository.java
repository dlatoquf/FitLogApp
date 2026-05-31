package com.fitlog.fitlog.inquiry.repository;

import com.fitlog.fitlog.inquiry.entity.Inquiry;
import com.fitlog.fitlog.trainer.entity.Trainer;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface InquiryRepository extends JpaRepository<Inquiry, Long> {
    List<Inquiry> findByTrainerOrderByCreatedAtDesc(Trainer trainer);
    List<Inquiry> findAllByOrderByCreatedAtDesc();
}
