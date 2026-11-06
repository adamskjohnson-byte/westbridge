<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('card_purchase_attempts', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('card_id')->constrained('cards')->restrictOnDelete();
            $table->string('idempotency_key', 36);
            $table->char('request_hash', 64);
            $table->string('status', 20);
            $table->string('decline_code', 40)->nullable();
            $table->unsignedBigInteger('transaction_id')->nullable()->constrained('transactions')->nullOnDelete();
            $table->unsignedBigInteger('balance_after_cents')->nullable();
            $table->timestamps();
            $table->unique(['user_id', 'idempotency_key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('card_purchase_attempts');
    }
};