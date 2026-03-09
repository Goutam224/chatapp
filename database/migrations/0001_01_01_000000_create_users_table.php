<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
public function up(): void
{
    Schema::create('users', function (Blueprint $table) {
        $table->id();

        // WhatsApp uses phone instead of email
        $table->string('phone')->unique();

        $table->string('name');
        $table->text('about')->nullable();
        $table->string('profile_photo')->nullable();

        $table->boolean('is_phone_verified')->default(false);
        $table->string('account_status')->default('active');

        $table->timestamps();
    });
}


    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('users');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('sessions');
    }
};
