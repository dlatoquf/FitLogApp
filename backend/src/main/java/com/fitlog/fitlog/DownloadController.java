package com.fitlog.fitlog;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class DownloadController {

    private static final String PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.anonymous.FitLogApp";
    private static final String APP_STORE_URL = "https://apps.apple.com/app/fitlog/id6769366090";

    @GetMapping(value = "/download/android", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> downloadAndroid(HttpServletRequest request) {
        String ua = request.getHeader("User-Agent");
        boolean isAndroid = ua != null && ua.contains("Android");
        if (!isAndroid) return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        return redirect(PLAY_STORE_URL);
    }

    @GetMapping(value = "/download/ios", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> downloadIos(HttpServletRequest request) {
        String ua = request.getHeader("User-Agent");
        boolean isAndroid = ua != null && ua.contains("Android");
        if (isAndroid) return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        return redirect(APP_STORE_URL);
    }

    @GetMapping(value = "/download", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> download(HttpServletRequest request) {
        String ua = request.getHeader("User-Agent");
        boolean isAndroid = ua != null && ua.contains("Android");
        return redirect(isAndroid ? PLAY_STORE_URL : APP_STORE_URL);
    }

    private ResponseEntity<String> redirect(String url) {
        String html = "<!DOCTYPE html><html><head><meta charset='UTF-8'>" +
                "<meta name='viewport' content='width=device-width,initial-scale=1'>" +
                "<script>window.location.replace('" + url + "');</script>" +
                "</head><body></body></html>";
        return ResponseEntity.ok(html);
    }
}
