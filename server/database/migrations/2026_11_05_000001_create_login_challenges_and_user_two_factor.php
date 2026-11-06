<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('users', 'two_factor_enabled_at')) {
            Schema::table('users', function (Blueprint $table): void {
                $table->timestamp('two_factor_enabled_at')->nullable();
            });
        }

        if (! Schema::hasTable('login_challenges')) Schema::create('login_challenges', function (Blueprint $table): void {
            $table->engine = 'InnoDB';
            $table->ulid('id')->primary();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->enum('purpose', ['login', 'enable', 'disable']);
            $table->char('code_hash', 64);
            $table->unsignedTinyInteger('attempts')->default(0);
            $table->dateTime('expires_at');
            $table->timestamp('consumed_at')->nullable();
            $table->unsignedTinyInteger('resend_count')->default(0);
            $table->timestamp('last_sent_at')->useCurrent();
            $table->string('ip_address', 45)->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->index(['user_id', 'purpose', 'consumed_at']);
            $table->index('expires_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('login_challenges');
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn('two_factor_enabled_at'));
    }
};