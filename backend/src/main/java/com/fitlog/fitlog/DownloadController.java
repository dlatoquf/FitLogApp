package com.fitlog.fitlog;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;

@RestController
public class DownloadController {

    private static final String PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.anonymous.FitLogApp";
    private static final String APP_STORE_URL = "https://apps.apple.com/app/fitlog/id6769366090";

    @GetMapping("/download")
    public ResponseEntity<Void> download(HttpServletRequest request) {
        String ua = request.getHeader("User-Agent");
        String target = (ua != null && ua.contains("Android")) ? PLAY_STORE_URL : APP_STORE_URL;
        return ResponseEntity.status(HttpStatus.FOUND)
                .header(HttpHeaders.LOCATION, target)
                .build();
    }
}
