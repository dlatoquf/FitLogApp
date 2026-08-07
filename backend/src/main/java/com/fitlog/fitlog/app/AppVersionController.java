package com.fitlog.fitlog.app;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/app")
public class AppVersionController {

    private static final String MIN_VERSION = "3.1.0";

    @GetMapping("/version")
    public Map<String, String> getVersion() {
        return Map.of("minVersion", MIN_VERSION);
    }
}
