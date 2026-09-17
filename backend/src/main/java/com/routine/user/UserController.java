package com.routine.user;

import com.routine.auth.AuthPrincipal;
import com.routine.user.dto.ChangePasswordRequest;
import com.routine.user.dto.SettingsResponse;
import com.routine.user.dto.UpdateProfileRequest;
import com.routine.user.dto.UpdateSettingsRequest;
import com.routine.user.dto.UserResponse;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/me")
    public UserResponse me(@AuthenticationPrincipal AuthPrincipal principal) {
        return userService.profile(principal.id());
    }

    @PutMapping("/me")
    public UserResponse updateMe(@AuthenticationPrincipal AuthPrincipal principal,
                                 @Valid @RequestBody UpdateProfileRequest request) {
        return userService.updateProfile(principal.id(), request);
    }

    @PostMapping("/me/password")
    public ResponseEntity<Void> changePassword(@AuthenticationPrincipal AuthPrincipal principal,
                                               @Valid @RequestBody ChangePasswordRequest request) {
        userService.changePassword(principal.id(), request);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/me/settings")
    public SettingsResponse settings(@AuthenticationPrincipal AuthPrincipal principal) {
        return userService.settings(principal.id());
    }

    @PutMapping("/me/settings")
    public SettingsResponse updateSettings(@AuthenticationPrincipal AuthPrincipal principal,
                                           @Valid @RequestBody UpdateSettingsRequest request) {
        return userService.updateSettings(principal.id(), request);
    }
}
