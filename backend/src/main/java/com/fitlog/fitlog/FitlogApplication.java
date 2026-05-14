package com.fitlog.fitlog;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class FitlogApplication {

    public static void main(String[] args) {
        SpringApplication.run(FitlogApplication.class, args);
    }

}