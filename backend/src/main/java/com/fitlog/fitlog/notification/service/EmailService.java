package com.fitlog.fitlog.notification.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import jakarta.mail.internet.MimeMessage;
import java.util.logging.Logger;

@Service
public class EmailService {

    private static final Logger log = Logger.getLogger(EmailService.class.getName());

    private final JavaMailSender mailSender;

    @Value("${admin.email:wearefitlog@gmail.com}")
    private String adminEmail;

    @Value("${spring.mail.username:wearefitlog@gmail.com}")
    private String fromEmail;

    public EmailService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    /**
     * 문의 접수 시 관리자에게 이메일 알림
     */
    public void sendInquiryNotice(String trainerName, String title, String content, Long inquiryId) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, false, "UTF-8");

            helper.setFrom(fromEmail);
            helper.setTo(adminEmail);
            helper.setSubject("[FitLog 문의] " + title);

            String body = """
                    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
                      <h2 style="color: #1a1a1a; margin-bottom: 4px;">📩 새 문의가 접수됐어요</h2>
                      <p style="color: #666; margin-top: 4px; margin-bottom: 24px;">FitLog 앱에서 문의가 등록됐습니다.</p>

                      <table style="width: 100%%; border-collapse: collapse; margin-bottom: 20px;">
                        <tr>
                          <td style="padding: 10px 14px; background: #f3f4f6; border-radius: 6px 6px 0 0; font-size: 13px; color: #555; width: 100px;">문의 번호</td>
                          <td style="padding: 10px 14px; background: #f9fafb; border-radius: 6px 6px 0 0; font-size: 13px; color: #111;">#%d</td>
                        </tr>
                        <tr>
                          <td style="padding: 10px 14px; background: #f3f4f6; font-size: 13px; color: #555;">트레이너</td>
                          <td style="padding: 10px 14px; background: #f9fafb; font-size: 13px; color: #111;">%s</td>
                        </tr>
                        <tr>
                          <td style="padding: 10px 14px; background: #f3f4f6; font-size: 13px; color: #555;">제목</td>
                          <td style="padding: 10px 14px; background: #f9fafb; font-size: 13px; color: #111;">%s</td>
                        </tr>
                      </table>

                      <div style="background: #f9fafb; border-left: 4px solid #22c55e; padding: 16px 20px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
                        <p style="margin: 0; font-size: 14px; color: #333; white-space: pre-wrap;">%s</p>
                      </div>

                      <p style="font-size: 12px; color: #9ca3af;">이 이메일에 직접 답장하면 관리자 메일함으로 전달됩니다.</p>
                    </div>
                    """.formatted(inquiryId, trainerName, title, content);

            helper.setText(body, true); // HTML
            mailSender.send(message);
            log.info("[EmailService] 문의 알림 이메일 발송 완료: #" + inquiryId);
        } catch (Exception e) {
            log.warning("[EmailService] 이메일 발송 실패: " + e.getMessage());
        }
    }
}
