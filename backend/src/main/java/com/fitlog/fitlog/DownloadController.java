package com.fitlog.fitlog;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class DownloadController {

    private static final String PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.anonymous.FitLogApp";
    private static final String APP_STORE_URL = "https://apps.apple.com/app/fitlog/id6769366090";

    @GetMapping(value = "/download", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> download(HttpServletRequest request) {
        String html = "<!DOCTYPE html><html><head><meta charset='UTF-8'>" +
                "<script>" +
                "var ua = navigator.userAgent || '';" +
                "if (/android/i.test(ua)) {" +
                "  window.location.href = '" + PLAY_STORE_URL + "';" +
                "} else {" +
                "  window.location.href = '" + APP_STORE_URL + "';" +
                "}" +
                "</script></head><body></body></html>";
        return ResponseEntity.ok(html);
    }
}
