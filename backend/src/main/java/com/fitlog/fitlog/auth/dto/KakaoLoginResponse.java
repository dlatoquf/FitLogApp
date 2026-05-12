package com.fitlog.fitlog.auth.dto;

public class KakaoLoginResponse {
    private String jwt;
    private boolean isNewUser;
    private String role;  // "TRAINER" | "MEMBER" | null

    public KakaoLoginResponse(String jwt, boolean isNewUser, String role) {
        this.jwt = jwt;
        this.isNewUser = isNewUser;
        this.role = role;
    }

    public String getJwt() { return jwt; }
    public boolean isNewUser() { return isNewUser; }
    public String getRole() { return role; }
}