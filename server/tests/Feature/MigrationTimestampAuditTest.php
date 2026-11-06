<?php

namespace Tests\Feature;

use Tests\TestCase;

class MigrationTimestampAuditTest extends TestCase
{
    public function test_non_nullable_timestamp_columns_have_defaults_or_later_datetime_conversions(): void
    {
        $directory = database_path('migrations');
        $files = glob($directory.'/*.php') ?: [];
        sort($files);
        $unsafe = [];

        foreach ($files as $index => $file) {
            $source = file_get_contents($file);
            if ($source === false) {
                $this->fail('Could not read migration: '.$file);
            }
            $source = explode('public function down', $source, 2)[0];

            preg_match_all('/Schema::(?:create|table)\(\s*[\'\"]([^\'\"]+)[\'\"]\s*,\s*function\s*\(Blueprint\s+\$table\)[^{]*\{(.*?)\n\s*\}\);/s', $source, $schemaBlocks, PREG_SET_ORDER);
            foreach ($schemaBlocks as $schemaBlock) {
                $tableName = $schemaBlock[1];
                preg_match_all('/\$table->timestamp\(\s*[\'\"]([^\'\"]+)[\'\"]\s*\)([^;]*);/s', $schemaBlock[2], $columns, PREG_SET_ORDER);
                foreach ($columns as $column) {
                    $definition = $column[2];
                    if (str_contains($definition, '->nullable(') || str_contains($definition, '->default(') || str_contains($definition, '->useCurrent(')) {
                        continue;
                    }

                    $convertedLater = false;
                    foreach (array_slice($files, $index + 1) as $laterFile) {
                        $laterSource = file_get_contents($laterFile) ?: '';
                        if (preg_match('/Schema::table\(\s*[\'\"]'.preg_quote($tableName, '/').'[\'\"]/s', $laterSource)
                            && preg_match('/\$table->dateTime\(\s*[\'\"]'.preg_quote($column[1], '/').'[\'\"]\s*\)->change\(\)/s', $laterSource)) {
                            $convertedLater = true;
                            break;
                        }
                    }

                    if (! $convertedLater) {
                        $unsafe[] = basename($file).": {$tableName}.{$column[1]}";
                    }
                }
            }
        }

        $this->assertSame([], $unsafe, "Non-nullable TIMESTAMP columns need an explicit default or a later DATETIME conversion:\n".implode("\n", $unsafe));
    }
}