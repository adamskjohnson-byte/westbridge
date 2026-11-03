<?php

namespace App\Enums;

enum TransferStatus: string
{
    case Pending = 'pending';
    case Completed = 'completed';
    case Failed = 'failed';
}
