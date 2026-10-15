package com.kharchabaki.app.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch

private val tabs = listOf("Overview", "History", "Analytics", "Loans", "Profile")

@Composable
fun KharchabakiApp(state: AppUiState, onAction: (AppAction) -> Unit, toolContent: @Composable (route: String, onBack: () -> Unit) -> Unit = { _, _ -> }) {
    KharchabakiTheme(state.finance.preferences.theme) {
        var tab by rememberSaveable { mutableIntStateOf(0) }
        var tool by rememberSaveable { mutableStateOf<String?>(null) }
        val snackbar = remember { SnackbarHostState() }
        LaunchedEffect(state.message, state.error) {
            val text = state.error ?: state.message
            if (text != null) { snackbar.showSnackbar(text); onAction(AppAction.DismissMessage) }
        }
        BackHandler(enabled = tool != null) { tool = null }
        Scaffold(
            containerColor = MaterialTheme.colorScheme.background,
            snackbarHost = { SnackbarHost(snackbar) },
            bottomBar = {
                if (state.authenticated && tool == null) {
                    NavigationBar(containerColor = MaterialTheme.colorScheme.surface, tonalElevation = 0.dp) {
                        tabs.forEachIndexed { index, title ->
                            NavigationBarItem(selected = tab == index, onClick = { tab = index }, icon = { NavIcon(index) },
                                label = { Text(title, fontSize = 10.sp, maxLines = 1) },
                                colors = NavigationBarItemDefaults.colors(indicatorColor = MaterialTheme.colorScheme.primaryContainer, selectedIconColor = MaterialTheme.colorScheme.primary, selectedTextColor = MaterialTheme.colorScheme.primary))
                        }
                    }
                }
            },
        ) { padding ->
            Box(Modifier.fillMaxSize().padding(padding)) {
                when {
                    !state.authenticated -> WelcomeScreen(state, onAction)
                    !state.finance.ready -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
                    tool != null -> toolContent(tool!!) { tool = null }
                    tab == 0 -> OverviewScreen(state, onAction, onHistory = { tab = 1 })
                    tab == 1 -> HistoryScreen(state, onAction)
                    tab == 2 -> AnalyticsScreen(state)
                    tab == 3 -> LoansScreen(state, onAction)
                    else -> ProfileScreen(state, onAction) { tool = it }
                }
                if (state.loading && state.authenticated) LinearProgressIndicator(Modifier.fillMaxWidth().align(Alignment.TopCenter))
            }
        }
    }
}

@Composable
private fun NavIcon(index: Int) {
    val color = LocalContentColor.current
    Canvas(Modifier.size(24.dp)) {
        val s = size.width / 24f
        val stroke = Stroke(1.7f * s)
        when (index) {
            0 -> {
                val path = Path().apply { moveTo(3*s, 10*s); lineTo(12*s, 3*s); lineTo(21*s, 10*s); lineTo(21*s, 21*s); lineTo(15*s, 21*s); lineTo(15*s, 14*s); lineTo(9*s, 14*s); lineTo(9*s, 21*s); lineTo(3*s, 21*s); close() }
                drawPath(path, color, style = stroke)
            }
            1 -> { drawRoundRect(color, Offset(4*s, 3*s), Size(16*s, 18*s), CornerRadius(2*s), style = stroke); (8..16 step 4).forEach { drawLine(color, Offset(8*s, it*s), Offset(16*s, it*s), 1.7f*s) } }
            2 -> { listOf(10f, 17f, 13f).forEachIndexed { i, h -> drawRoundRect(color, Offset((4 + i*6)*s, (21-h)*s), Size(3*s, h*s), CornerRadius(1*s)) } }
            3 -> { drawRoundRect(color, Offset(2*s, 6*s), Size(20*s, 14*s), CornerRadius(3*s), style = stroke); drawLine(color, Offset(2*s, 10*s), Offset(22*s, 10*s), 1.7f*s); drawCircle(color, 1.5f*s, Offset(17*s, 15*s)) }
            else -> { drawCircle(color, 4*s, Offset(12*s, 7*s), style = stroke); drawArc(color, 180f, 180f, false, Offset(4*s, 14*s), Size(16*s, 14*s), style = stroke) }
        }
    }
}

@Composable
private fun WelcomeScreen(state: AppUiState, onAction: (AppAction) -> Unit) {
    var emailForm by remember { mutableStateOf(false) }
    var email by rememberSaveable { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Surface(shape = RoundedCornerShape(11.dp), color = MaterialTheme.colorScheme.primary) { Text("₹", Modifier.padding(horizontal = 13.dp, vertical = 7.dp), color = MaterialTheme.colorScheme.onPrimary, fontSize = 24.sp, fontWeight = FontWeight.Bold) }
            Text("kharchabaki", fontWeight = FontWeight.SemiBold, fontSize = 21.sp)
        }
        Spacer(Modifier.height(16.dp))
        Text("Spend with clarity.\nSave with intent.", style = MaterialTheme.typography.displaySmall, lineHeight = 44.sp, fontWeight = FontWeight.Bold, letterSpacing = (-1.5).sp)
        Text("Your everyday money, beautifully in focus. Track expenses, plan ahead, and give every rupee a purpose.", style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant, lineHeight = 26.sp)
        FinanceCard(Modifier.fillMaxWidth()) {
            Text("A clearer picture of your money", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text("₹ 1,24,850.00", fontSize = 32.sp, fontWeight = FontWeight.SemiBold, letterSpacing = (-1).sp)
            Text("Illustrative monthly overview", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.bodySmall)
            val accent = MaterialTheme.colorScheme.primary
            val muted = MaterialTheme.colorScheme.surfaceVariant
            Canvas(Modifier.fillMaxWidth().height(88.dp).padding(top = 10.dp)) {
                val heights = listOf(.35f,.5f,.42f,.6f,.47f,.66f,.57f,.74f,.62f,.82f,.7f,.95f)
                val width = size.width / heights.size
                heights.forEachIndexed { i, h -> drawRoundRect(if (i >= 9) accent else muted, Offset(i*width, size.height*(1-h)), Size(width - 5.dp.toPx(), size.height*h), CornerRadius(4.dp.toPx())) }
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { listOf("Oct", "Jan", "Apr", "Jul", "Sep").forEach { Text(it, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant) } }
        }
        Spacer(Modifier.height(4.dp))
        Button(onClick = { onAction(AppAction.SignIn) }, enabled = !state.loading, modifier = Modifier.fillMaxWidth().height(56.dp), shape = RoundedCornerShape(18.dp)) {
            if (state.loading) CircularProgressIndicator(Modifier.size(20.dp), color = MaterialTheme.colorScheme.onPrimary, strokeWidth = 2.dp)
            else Text("G", fontWeight = FontWeight.Bold, fontSize = 22.sp)
            Spacer(Modifier.width(12.dp)); Text(if (state.loading) "Connecting…" else "Continue with Google", fontWeight = FontWeight.SemiBold)
        }
        OutlinedButton(onClick = { onAction(AppAction.StartOffline) }, enabled = !state.loading, modifier = Modifier.fillMaxWidth().height(56.dp), shape = RoundedCornerShape(18.dp)) { Text("Continue offline", color = MaterialTheme.colorScheme.onBackground, fontWeight = FontWeight.SemiBold) }
        TextButton(onClick = { emailForm = true }, enabled = !state.loading, modifier = Modifier.align(Alignment.CenterHorizontally)) { Text("Sign in with email") }
        Text("No account needed for offline use. Your data stays on this device. Cloud sync is a Premium feature.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
        state.error?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium) }
        Spacer(Modifier.height(8.dp))
    }
    if (emailForm) EditorDialog("Welcome back", { emailForm = false }, "Sign in", valid = email.contains('@') && password.isNotBlank() && !state.loading, onConfirm = { onAction(AppAction.EmailSignIn(email.trim(), password)); emailForm = false }) {
        OutlinedTextField(email, { email = it }, label = { Text("Email") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email), modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp))
        OutlinedTextField(password, { password = it }, label = { Text("Password") }, singleLine = true, visualTransformation = PasswordVisualTransformation(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password), modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp))
    }
}
