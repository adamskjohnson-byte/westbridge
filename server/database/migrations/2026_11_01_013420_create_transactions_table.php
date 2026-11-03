<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Record immutable account ledger entries without update timestamps or soft deletes.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('transactions', function (Blueprint $table) {
            $table->engine = 'InnoDB';
            $table->charset = 'utf8mb4';
            $table->collation = 'utf8mb4_unicode_ci';
            $table->id();
            $table->foreignId('account_id')->constrained('accounts')->restrictOnDelete();
            $table->foreignUlid('transfer_id')->nullable()->constrained('transfers')->restrictOnDelete();
            $table->enum('direction', ['credit', 'debit']);
            $table->unsignedBigInteger('amount_cents');
            $table->unsignedBigInteger('balance_after_cents');
            $table->enum('category', ['transfer', 'deposit', 'withdrawal', 'bill_payment', 'card', 'fee', 'interest', 'other']);
            $table->string('description', 255);
            $table->string('counterparty_name', 120)->nullable();
            $table->char('reference', 26)->unique();
            $table->timestamp('posted_at');
            $table->timestamp('created_at')->useCurrent();
            $table->index(['account_id', 'posted_at']);
            $table->index(['account_id', 'category']);
            $table->index('transfer_id');
        });

        if (DB::getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE transactions ADD CONSTRAINT chk_transactions_amount_positive CHECK (amount_cents > 0)');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('transactions');
    }
};
