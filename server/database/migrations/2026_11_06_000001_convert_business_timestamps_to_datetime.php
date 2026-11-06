<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('accounts', function (Blueprint $table): void {
            $table->dateTime('opened_at')->change();
        });

        Schema::table('transactions', function (Blueprint $table): void {
            $table->dateTime('posted_at')->change();
        });
    }

    public function down(): void
    {
        Schema::table('accounts', function (Blueprint $table): void {
            $table->timestamp('opened_at')->default('1970-01-01 00:00:01')->change();
        });

        Schema::table('transactions', function (Blueprint $table): void {
            $table->timestamp('posted_at')->default('1970-01-01 00:00:01')->change();
        });
    }
};