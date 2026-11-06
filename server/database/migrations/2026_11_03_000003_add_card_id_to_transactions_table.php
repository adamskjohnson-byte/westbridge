<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('transactions', function (Blueprint $table): void {
            $table->foreignId('card_id')->nullable()->after('account_id')->constrained('cards')->nullOnDelete();
            $table->index(['card_id', 'posted_at']);
        });
    }

    public function down(): void
    {
        Schema::table('transactions', function (Blueprint $table): void {
            $table->dropIndex(['card_id', 'posted_at']);
            $table->dropConstrainedForeignId('card_id');
        });
    }
};