<?php
// app/Http/Controllers/TokenExchangeController.php

namespace App\Http\Controllers;

use App\Models\ApiClient;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

class TokenExchangeController extends Controller
{
    public function exchange(Request $request): JsonResponse
    {
        // ── Step 1: Validate incoming request ────────────────────
        $validated = $request->validate([
            'api_key'     => 'required|string',
            'external_id' => 'required|string',
            'name'        => 'required|string|max:255',
            'avatar'      => 'nullable|string|url',
            'email'       => 'nullable|string|email',
            'username'    => 'nullable|string|max:255',
            'phone'       => 'nullable|string|max:20',
        ]);

        // ── Step 2: Validate api_key ─────────────────────────────
        $client = ApiClient::findByKey($validated['api_key']);

        if (!$client) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid API key',
            ], 401);
        }

        if (!$client->isActive()) {
            return response()->json([
                'success' => false,
                'message' => 'API client is inactive',
            ], 403);
        }

        // ── Step 3: Find or create user ──────────────────────────
        // Scoped to this api_client only
        // Same external_id from different apps = different users
        $user = User::firstOrCreate(
            [
                'external_id'   => $validated['external_id'],
                'api_client_id' => $client->id,
            ],
            [
                'name'             => $validated['name'],
                'photo'            => $validated['avatar'] ?? null,
                'email'            => $validated['email'] ?? null,
                'username'         => $validated['username'] ?? null,
                'phone'            => null, // external users never use phone
                'is_phone_verified'=> false,
                'account_status'   => 'active',
            ]
        );

        // ── Step 4: Update profile if user already exists ────────
        // Name or avatar may change on their system
        if (!$user->wasRecentlyCreated) {
            $user->update([
                'name'     => $validated['name'],
                'photo'    => $validated['avatar'] ?? $user->photo,
                'email'    => $validated['email'] ?? $user->email,
                'username' => $validated['username'] ?? $user->username,
            ]);
        }

        // ── Step 5: Revoke old tokens (optional but clean) ───────
        // Each login gets a fresh token
        $user->tokens()->delete();

        // ── Step 6: Issue new Sanctum token ──────────────────────
        $token = $user->createToken('chat-access')->plainTextToken;

        Log::info('Token exchange successful', [
            'api_client' => $client->app_name,
            'external_id' => $validated['external_id'],
            'user_id' => $user->id,
            'was_created' => $user->wasRecentlyCreated,
        ]);

        // ── Step 7: Return token ─────────────────────────────────
        return response()->json([
            'success'  => true,
            'token'    => $token,
            'user_id'  => $user->id,
            'is_new'   => $user->wasRecentlyCreated,
            'user'     => [
                'id'       => $user->id,
                'name'     => $user->name,
                'username' => $user->username,
                'photo'    => $user->photo,
                'email'    => $user->email,
            ],
        ]);
    }
}