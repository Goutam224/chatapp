<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {

    public function up()
    {
        DB::statement("
            ALTER TABLE messages
            MODIFY type ENUM(
                'text',
                'image',
                'video',
                'audio',
                'file',
                'link',
                'system'
            ) DEFAULT 'text'
        ");
    }

    public function down()
    {
        DB::statement("
            ALTER TABLE messages
            MODIFY type ENUM(
                'text',
                'image',
                'video',
                'audio',
                'file'
            ) DEFAULT 'text'
        ");
    }

};
