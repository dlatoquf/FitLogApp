package com.fitlog.fitlog.comment.dto;

import com.fitlog.fitlog.comment.entity.Comment;
import java.time.LocalDateTime;

public class CommentResponse {
    private Long id;
    private String content;
    private String authorName;
    private String authorRole;
    private Long authorUserId;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static CommentResponse from(Comment c) {
        return from(c, c.getAuthor().getName());
    }

    public static CommentResponse from(Comment c, String displayName) {
        CommentResponse r = new CommentResponse();
        r.id = c.getId();
        r.content = c.getContent();
        r.authorName = displayName;
        r.authorRole = c.getAuthorRole();
        r.authorUserId = c.getAuthor().getId();
        r.createdAt = c.getCreatedAt();
        r.updatedAt = c.getUpdatedAt();
        return r;
    }

    public Long getId() { return id; }
    public String getContent() { return content; }
    public String getAuthorName() { return authorName; }
    public String getAuthorRole() { return authorRole; }
    public Long getAuthorUserId() { return authorUserId; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
