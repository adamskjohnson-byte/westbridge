<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Store transfer requests and their idempotency state.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('transfers', function (Blueprint $table) {
            $table->engine = 'InnoDB';
            $table->charset = 'utf8mb4';
            $table->collation = 'utf8mb4_unicode_ci';
            $table->ulid('id')->primary();
            $table->foreignId('initiated_by_user_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('from_account_id')->constrained('accounts')->restrictOnDelete();
            $table->foreignId('to_account_id')->constrained('accounts')->restrictOnDelete();
            $table->unsignedBigInteger('amount_cents');
            $table->char('currency', 3)->default('USD');
            $table->string('memo', 140)->nullable();
            $table->enum('status', ['pending', 'completed', 'failed'])->default('pending');
            $table->string('failure_reason')->nullable();
            $table->string('idempotency_key', 64)->nullable();
            $table->timestamps();
            $table->unique(['initiated_by_user_id', 'idempotency_key']);
            $table->index('from_account_id');
            $table->index('to_account_id');
        });

        if (DB::getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE transfers ADD CONSTRAINT chk_transfers_amount_positive CHECK (amount_cents > 0)');
            DB::statement('ALTER TABLE transfers ADD CONSTRAINT chk_transfers_distinct_accounts CHECK (from_account_id <> to_account_id)');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('transfers');
    }
};
