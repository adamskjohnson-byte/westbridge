<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Store customer account metadata and non-negative balances.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('accounts', function (Blueprint $table) {
            $table->engine = 'InnoDB';
            $table->charset = 'utf8mb4';
            $table->collation = 'utf8mb4_unicode_ci';
            $table->id();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->char('account_number', 10)->unique();
            $table->enum('type', ['checking', 'savings']);
            $table->string('nickname')->nullable();
            $table->char('currency', 3)->default('USD');
            $table->unsignedBigInteger('balance_cents')->default(0);
            $table->enum('status', ['active', 'frozen', 'closed'])->default('active');
            $table->timestamp('opened_at');
            $table->timestamps();
            $table->index('user_id');
        });

        if (DB::getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE accounts ADD CONSTRAINT chk_accounts_balance_nonnegative CHECK (balance_cents >= 0)');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('accounts');
    }
};
