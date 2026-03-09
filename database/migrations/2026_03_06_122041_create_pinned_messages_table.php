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
    {Schema::create('pinned_messages', function (Blueprint $table) {

    $table->id();

    $table->unsignedBigInteger('message_id');

    $table->unsignedBigInteger('user_id');

    $table->unsignedBigInteger('chat_id');

    $table->timestamp('pinned_at')->nullable();

    $table->index(['user_id','chat_id']);
    $table->index('message_id');

});
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('pinned_messages');
    }
};
