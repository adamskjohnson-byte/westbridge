<?php

namespace App\Enums;

enum TransactionCategory: string
{
    case Transfer = 'transfer';
    case Deposit = 'deposit';
    case Withdrawal = 'withdrawal';
    case BillPayment = 'bill_payment';
    case Card = 'card';
    case Fee = 'fee';
    case Interest = 'interest';
    case Other = 'other';
}
