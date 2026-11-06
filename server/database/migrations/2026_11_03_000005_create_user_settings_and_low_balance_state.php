<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_settings', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('locale', 10)->nullable();
            $table->enum('theme', ['light', 'dark', 'system'])->default('system');
            $table->boolean('email_activity')->default(true);
            $table->unsignedBigInteger('low_balance_threshold_cents')->nullable();
            $table->timestamps();
        });
        Schema::table('accounts', function (Blueprint $table): void {
            $table->boolean('low_balance_notified')->default(false);
        });
    }

    public function down(): void
    {
        Schema::table('accounts', fn (Blueprint $table) => $table->dropColumn('low_balance_notified'));
        Schema::dropIfExists('user_settings');
    }
};