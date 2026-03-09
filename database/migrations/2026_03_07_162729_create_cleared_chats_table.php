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
        Schema::create('cleared_chats', function (Blueprint $table) {

    $table->id();

    $table->unsignedBigInteger('chat_id');
    $table->unsignedBigInteger('user_id');

    $table->timestamp('cleared_at');

    $table->timestamps();

    $table->unique(['chat_id','user_id']);

});
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('cleared_chats');
    }
};
