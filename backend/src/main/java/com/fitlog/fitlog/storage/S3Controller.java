package com.fitlog.fitlog.storage;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PresignedPutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

import java.time.Duration;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/storage")
public class S3Controller {

    @Value("${aws.s3.bucket}")
    private String bucket;

    @Value("${aws.s3.region}")
    private String region;

    @Value("${aws.s3.access-key}")
    private String accessKey;

    @Value("${aws.s3.secret-key}")
    private String secretKey;

    @Value("${aws.cloudfront.domain}")
    private String cloudfrontDomain;

    @PostMapping("/presigned-url")
    public ResponseEntity<Map<String, String>> getPresignedUrl(@RequestBody Map<String, String> body) {
        String contentType = body.getOrDefault("contentType", "image/jpeg");
        String folder = body.getOrDefault("folder", "uploads");
        String ext = contentType.contains("video") ? "mp4" : contentType.contains("png") ? "png" : "jpg";
        String key = folder + "/" + UUID.randomUUID() + "." + ext;

        S3Presigner presigner = S3Presigner.builder()
                .region(Region.of(region))
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(accessKey, secretKey)))
                .build();

        PutObjectRequest putRequest = PutObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .contentType(contentType)
                .build();

        PresignedPutObjectRequest presignedRequest = presigner.presignPutObject(
                PutObjectPresignRequest.builder()
                        .signatureDuration(Duration.ofMinutes(10))
                        .putObjectRequest(putRequest)
                        .build());

        presigner.close();

        String uploadUrl = presignedRequest.url().toString();
        String publicUrl = "https://" + cloudfrontDomain + "/" + key;

        return ResponseEntity.ok(Map.of(
                "uploadUrl", uploadUrl,
                "publicUrl", publicUrl,
                "key", key
        ));
    }
}
