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
       Schema::create('download_sessions', function (Blueprint $table) {
    $table->id();

    $table->unsignedBigInteger('user_id');
    $table->unsignedBigInteger('message_id');

    $table->unsignedBigInteger('downloaded_bytes')->default(0);
    $table->unsignedBigInteger('total_bytes');

    $table->boolean('completed')->default(false);

    $table->string('device_id')->nullable(); // browser session

    $table->timestamps();

    $table->index(['user_id', 'message_id']);
});
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('download_sessions');
    }
};
