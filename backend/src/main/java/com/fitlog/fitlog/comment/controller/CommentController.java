package com.fitlog.fitlog.comment.controller;

import com.fitlog.fitlog.comment.dto.CommentRequest;
import com.fitlog.fitlog.comment.dto.CommentResponse;
import com.fitlog.fitlog.comment.service.CommentService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/comments")
public class CommentController {

    private final CommentService commentService;

    public CommentController(CommentService commentService) {
        this.commentService = commentService;
    }

    @GetMapping
    public ResponseEntity<List<CommentResponse>> getComments(
            @RequestHeader("Authorization") String authorization,
            @RequestParam String targetType,
            @RequestParam Long targetId,
            @RequestParam(required = false) String date,
            @RequestParam(required = false) Long trainerId,
            @RequestParam(required = false) Long memberId) {
        return ResponseEntity.ok(commentService.getComments(targetType, targetId, date, trainerId, memberId));
    }

    @PostMapping
    public ResponseEntity<CommentResponse> addComment(
            @RequestHeader("Authorization") String token,
            @RequestParam String targetType,
            @RequestParam Long targetId,
            @RequestParam(required = false) String date,
            @RequestParam(required = false) Long trainerId,
            @RequestParam(required = false) Long memberId,
            @RequestBody CommentRequest req) {
        return ResponseEntity.ok(commentService.addComment(token, targetType, targetId, date, trainerId, memberId, req));
    }

    @PutMapping("/{commentId}")
    public ResponseEntity<CommentResponse> updateComment(
            @RequestHeader("Authorization") String token,
            @PathVariable Long commentId,
            @RequestBody CommentRequest req) {
        return ResponseEntity.ok(commentService.updateComment(token, commentId, req));
    }

    @DeleteMapping("/{commentId}")
    public ResponseEntity<Void> deleteComment(
            @RequestHeader("Authorization") String token,
            @PathVariable Long commentId) {
        commentService.deleteComment(token, commentId);
        return ResponseEntity.noContent().build();
    }
}
