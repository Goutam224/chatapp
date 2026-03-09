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
        Schema::create('upload_sessions', function (Blueprint $table) {

    $table->id();

    $table->string('upload_uuid')->unique();

    $table->unsignedBigInteger('user_id');

    $table->unsignedBigInteger('chat_id');

    $table->string('file_name');

    $table->string('file_path')->nullable();

    $table->string('mime_type')->nullable();

    $table->bigInteger('file_size')->default(0);

    $table->bigInteger('uploaded_bytes')->default(0);

    $table->enum('status', [
        'uploading',
        'completed',
        'cancelled'
    ])->default('uploading');

    $table->timestamps();
});
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('upload_sessions');
    }
};
