<?php
// database/migrations/2026_03_24_000002_modify_users_for_token_exchange.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {

            // ── Drop unique constraint on phone ──────────────────
            // OTP users still use phone, but external users won't
            // have a phone, so unique constraint must go
            $table->dropUnique('users_phone_unique');

            // ── Make phone nullable ──────────────────────────────
            // External users don't need phone
            // OTP users still have phone (nothing breaks)
            $table->string('phone')->nullable()->change();

            // ── Add external_id ──────────────────────────────────
            // Their MongoDB _id or any unique ID from their system
            $table->string('external_id')->nullable()->after('id');

            // ── Add api_client_id ────────────────────────────────
            // Which external app this user belongs to
            // NULL = OTP/local user (your existing users)
            $table->unsignedBigInteger('api_client_id')
                  ->nullable()
                  ->after('external_id');

            // ── Add photo ────────────────────────────────────────
            // Their cloudinary/cdn avatar URL
            $table->string('photo')->nullable()->after('profile_photo');

            // ── Add email ────────────────────────────────────────
            // Optional, they may send it
            $table->string('email')->nullable()->after('photo');

            // ── Add username ─────────────────────────────────────
            // Optional, like akki_123
            $table->string('username')->nullable()->after('email');

            // ── Foreign key ──────────────────────────────────────
            $table->foreign('api_client_id')
                  ->references('id')
                  ->on('api_clients')
                  ->nullOnDelete();

            // ── Unique: one external_id per api_client ───────────
            // Same user can't be created twice from same app
            // But same external_id CAN exist across different apps
            $table->unique(['external_id', 'api_client_id']);
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {

            $table->dropForeign(['api_client_id']);
            $table->dropUnique(['external_id', 'api_client_id']);
            $table->dropColumn([
                'external_id',
                'api_client_id',
                'photo',
                'email',
                'username'
            ]);

            // Restore phone to NOT NULL + unique
            $table->string('phone')->nullable(false)->change();
            $table->unique('phone');
        });
    }
};