<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('messages', function (Blueprint $table) {

            $table->boolean('is_pinned')->default(false);
            $table->unsignedBigInteger('pinned_by')->nullable();
            $table->timestamp('pinned_at')->nullable();

        });
    }

    public function down(): void
    {
        Schema::table('messages', function (Blueprint $table) {

            $table->dropColumn([
                'is_pinned',
                'pinned_by',
                'pinned_at'
            ]);

        });
    }
};