package com.kharchabaki.app.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

data class AppPalette(
    val key: String,
    val background: Color,
    val card: Color,
    val foreground: Color,
    val muted: Color,
    val subtle: Color,
    val border: Color,
    val primary: Color,
    val onPrimary: Color,
    val dark: Boolean = true,
)

val appPalettes = listOf(
    AppPalette("light", Color(0xFFF8FAFC), Color.White, Color(0xFF172033), Color(0xFFE8EDF4), Color(0xFF566479), Color(0xFFCBD5E1), Color(0xFF4D7C0F), Color.White, false),
    AppPalette("dark", Color(0xFF090B09), Color(0xFF151915), Color(0xFFF4F6F0), Color(0xFF232923), Color(0xFFA1AAA0), Color(0xFF364036), Color(0xFFCBFF3D), Color(0xFF18200A)),
    AppPalette("ocean", Color(0xFF081927), Color(0xFF102B40), Color(0xFFE8F7FF), Color(0xFF1B3C55), Color(0xFF9DBFD4), Color(0xFF31566F), Color(0xFF67D9F5), Color(0xFF062331)),
    AppPalette("forest", Color(0xFF0B1B15), Color(0xFF153025), Color(0xFFECFFF3), Color(0xFF214333), Color(0xFFA2C9B2), Color(0xFF39644C), Color(0xFF86EFAC), Color(0xFF102E1B)),
    AppPalette("sunset", Color(0xFF241319), Color(0xFF3A2028), Color(0xFFFFF1E9), Color(0xFF512F36), Color(0xFFD6ADB0), Color(0xFF70414B), Color(0xFFFDBA74), Color(0xFF432010)),
    AppPalette("rose", Color(0xFFFFF5F8), Color.White, Color(0xFF4B1836), Color(0xFFFCE4EF), Color(0xFF93546F), Color(0xFFE9B8CE), Color(0xFFBE185D), Color.White, false),
)

val incomeColor = Color(0xFF34C98B)
val expenseColor = Color(0xFFEF767A)

@Composable
fun KharchabakiTheme(theme: String = "dark", content: @Composable () -> Unit) {
    val p = appPalettes.firstOrNull { it.key == theme } ?: appPalettes[1]
    val colors = if (p.dark) darkColorScheme() else lightColorScheme()
    MaterialTheme(
        colorScheme = colors.copy(
            primary = p.primary,
            onPrimary = p.onPrimary,
            secondary = p.primary,
            onSecondary = p.onPrimary,
            background = p.background,
            onBackground = p.foreground,
            surface = p.card,
            onSurface = p.foreground,
            surfaceVariant = p.muted,
            onSurfaceVariant = p.subtle,
            outline = p.border,
            outlineVariant = p.border.copy(alpha = .5f),
            primaryContainer = p.primary.copy(alpha = .12f),
            onPrimaryContainer = p.foreground,
            error = if (p.dark) expenseColor else Color(0xFFB42336),
        ),
        content = content,
    )
}
