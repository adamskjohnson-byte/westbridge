<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('transfers', function (Blueprint $table): void {
            $table->string('destination_type', 24)->default('own')->after('to_account_id');
            $table->string('destination_name', 120)->nullable()->after('destination_type');
            $table->string('destination_number_masked', 32)->nullable()->after('destination_name');
            $table->string('destination_holder_masked', 80)->nullable()->after('destination_number_masked');
            $table->char('request_hash', 64)->nullable()->after('idempotency_key');
            $table->index(['initiated_by_user_id', 'created_at']);
        });

        Schema::create('bill_payments', function (Blueprint $table): void {
            $table->engine = 'InnoDB';
            $table->charset = 'utf8mb4';
            $table->collation = 'utf8mb4_unicode_ci';
            $table->ulid('id')->primary();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->foreignId('account_id')->constrained('accounts')->restrictOnDelete();
            $table->string('biller_code', 40);
            $table->string('biller_name', 120);
            $table->string('reference_number', 40);
            $table->unsignedBigInteger('amount_cents');
            $table->enum('status', ['completed', 'failed'])->default('completed');
            $table->foreignId('transaction_id')->constrained('transactions')->restrictOnDelete();
            $table->string('idempotency_key', 36);
            $table->char('request_hash', 64);
            $table->timestamp('created_at')->useCurrent();
            $table->unique(['user_id', 'idempotency_key']);
            $table->index(['user_id', 'created_at']);
            $table->index(['account_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bill_payments');
        Schema::table('transfers', function (Blueprint $table): void {
            $table->dropIndex(['initiated_by_user_id', 'created_at']);
            $table->dropColumn([
                'destination_type',
                'destination_name',
                'destination_number_masked',
                'destination_holder_masked',
                'request_hash',
            ]);
        });
    }
};
