<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->timestamp('last_login_at')->nullable()->after('email_verified_at');
            $table->index(['role', 'status', 'created_at']);
        });

        Schema::table('transactions', function (Blueprint $table): void {
            $table->index(['posted_at', 'amount_cents']);
            $table->index(['direction', 'category', 'posted_at']);
        });

        Schema::table('support_tickets', function (Blueprint $table): void {
            $table->index(['status', 'priority', 'created_at']);
            $table->index(['created_at', 'id']);
        });

        Schema::create('support_ticket_messages', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('ticket_id')->constrained('support_tickets')->cascadeOnDelete();
            $table->foreignId('admin_id')->nullable()->constrained('users')->nullOnDelete();
            $table->enum('type', ['note', 'reply']);
            $table->text('body');
            $table->timestamp('created_at')->useCurrent();
            $table->index('ticket_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('support_ticket_messages');
        Schema::table('support_tickets', function (Blueprint $table): void {
            $table->dropIndex(['status', 'priority', 'created_at']);
            $table->dropIndex(['created_at', 'id']);
        });
        Schema::table('transactions', function (Blueprint $table): void {
            $table->dropIndex(['posted_at', 'amount_cents']);
            $table->dropIndex(['direction', 'category', 'posted_at']);
        });
        Schema::table('users', function (Blueprint $table): void {
            $table->dropIndex(['role', 'status', 'created_at']);
            $table->dropColumn('last_login_at');
        });
    }
};
