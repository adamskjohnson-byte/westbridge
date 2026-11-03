<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('transactions', function (Blueprint $table): void {
            $table->index(['account_id', 'direction', 'posted_at'], 'transactions_account_direction_posted_index');
            $table->index(['account_id', 'category', 'posted_at'], 'transactions_account_category_posted_index');
        });
    }

    public function down(): void
    {
        Schema::table('transactions', function (Blueprint $table): void {
            $table->dropIndex('transactions_account_direction_posted_index');
            $table->dropIndex('transactions_account_category_posted_index');
        });
    }
};
