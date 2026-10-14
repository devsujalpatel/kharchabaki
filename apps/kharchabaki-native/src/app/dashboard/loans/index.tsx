import { type JSX, type ReactNode, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  HandCoins,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Linking from "expo-linking";
import { FormSheet } from "@/components/FormSheet";
import { useAppSession, useOfflineStatus } from "@/lib/session-provider";
import { usePreferences } from "@/lib/preferences";
import {
  createGivenLoan,
  createTakenLoan,
  deleteGivenLoan,
  deleteTakenLoan,
  getGivenLoans,
  getTakenLoans,
  recordGivenLoanPayment,
  recordTakenLoanPayment,
  type ApiResponse,
  type GivenLoan,
  type TakenLoan,
  updateGivenLoan,
  updateTakenLoan,
} from "@/lib/loan";

type LoanKind = "taken" | "given";
const initialForm = { amount: "", person: "", phoneNumber: "", interest: "0" };

export default function Loans(): JSX.Element {
  const queryClient = useQueryClient();
  const offline = useOfflineStatus();
  const { data: session } = useAppSession();
  const { colors, formatMoney } = usePreferences();
  const [kind, setKind] = useState<LoanKind>("taken");
  const [createKind, setCreateKind] = useState<LoanKind>("taken");
  const [editingLoan, setEditingLoan] = useState<{
    kind: LoanKind;
    loan: TakenLoan | GivenLoan;
  } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dueDate, setDueDate] = useState(new Date());
  const [form, setForm] = useState(initialForm);
  const [formError, setFormError] = useState("");
  const takenQuery = useQuery({ queryKey: ["loans", "taken"], queryFn: getTakenLoans });
  const givenQuery = useQuery({ queryKey: ["loans", "given"], queryFn: getGivenLoans });

  const refreshLoans = () => {
    void queryClient.invalidateQueries({ queryKey: ["loans"] });
    void queryClient.invalidateQueries({ queryKey: ["balance"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
  };
  const createMutation = useMutation<ApiResponse<TakenLoan> | ApiResponse<GivenLoan>, Error>({
    mutationFn: () => {
      const values = {
        amount: form.amount.trim(),
        dueDate: formatDateForApi(dueDate),
        interest: form.interest.trim(),
      };
      const phoneNumber = form.phoneNumber.trim() || undefined;
      if (editingLoan?.kind === "taken")
        return updateTakenLoan(editingLoan.loan.id, {
          ...values,
          borrowedFrom: form.person.trim(),
        });
      if (editingLoan?.kind === "given")
        return updateGivenLoan(editingLoan.loan.id, {
          ...values,
          borrowerName: form.person.trim(),
          phoneNumber,
        });
      return createKind === "taken"
        ? createTakenLoan({ ...values, borrowedFrom: form.person.trim() })
        : createGivenLoan({ ...values, borrowerName: form.person.trim(), phoneNumber });
    },
    onSuccess: () => {
      setShowForm(false);
      setForm(initialForm);
      setEditingLoan(null);
      setKind(createKind);
      refreshLoans();
    },
  });
  const selectedQuery = kind === "taken" ? takenQuery : givenQuery;
  const loans = selectedQuery.data?.data ?? [];
  const outstanding = loans.reduce(
    (sum, loan) => sum + Math.max(0, Number(loan.totalAmount) - Number(loan.paidAmount)),
    0
  );
  const canChange = !offline.syncEnabled || (offline.online && offline.pending === 0);
  const accent = kind === "taken" ? "#d97706" : "#059669";

  const openForm = () => {
    setEditingLoan(null);
    setCreateKind(kind);
    setForm(initialForm);
    setDueDate(new Date());
    setFormError("");
    setShowDatePicker(false);
    createMutation.reset();
    setShowForm(true);
  };
  const openEdit = (loanKind: LoanKind, loan: TakenLoan | GivenLoan) => {
    setEditingLoan({ kind: loanKind, loan });
    setCreateKind(loanKind);
    setForm({
      amount: loan.amount,
      person: "borrowedFrom" in loan ? loan.borrowedFrom : loan.borrowerName,
      phoneNumber: "borrowedFrom" in loan ? "" : loan.phoneNumber ?? "",
      interest: loan.interest,
    });
    const [year, month, day] = loan.dueDate.slice(0, 10).split("-").map(Number);
    setDueDate(new Date(year, month - 1, day));
    setFormError("");
    setShowDatePicker(false);
    createMutation.reset();
    setShowForm(true);
  };
  const submitLoan = () => {
    if (!canChange || createMutation.isPending) return;
    if (!Number.isFinite(Number(form.amount)) || Number(form.amount) <= 0) {
      setFormError("Enter an amount greater than zero.");
      return;
    }
    if (!form.person.trim()) {
      setFormError("Enter a person or bank name.");
      return;
    }
    if (
      !form.interest.trim() ||
      !Number.isFinite(Number(form.interest)) ||
      Number(form.interest) < 0
    ) {
      setFormError("Interest must be zero or greater.");
      return;
    }
    setFormError("");
    createMutation.mutate();
  };

  return (
    <View className="flex-1 bg-app-bg">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-5 pb-8 pt-6">
        <View className="mb-6 flex-row items-center justify-between">
          <Text className="text-3xl font-semibold tracking-tight text-app-text">Loans</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Add ${kind === "taken" ? "borrowed" : "lent"} loan`}
            disabled={!canChange}
            onPress={openForm}
            className={`h-12 w-12 items-center justify-center rounded-2xl bg-app-primary ${!canChange ? "opacity-40" : ""}`}
          >
            <Plus size={23} color={colors.onPrimary} />
          </Pressable>
        </View>
        <LoanTabs kind={kind} onChange={setKind} />
        <View className="my-5 rounded-[22px] border border-app-border bg-app-card p-5">
          <View className="flex-row items-center gap-2">
            {kind === "taken" ? (
              <ArrowDownLeft size={18} color={accent} />
            ) : (
              <ArrowUpRight size={18} color={accent} />
            )}
            <Text className="flex-1 text-sm text-app-subtle">
              {kind === "taken" ? "To repay" : "To collect"}
            </Text>
            {!selectedQuery.isPending && !selectedQuery.isError && (
              <Text className="text-xs text-app-subtle">
                {loans.length} {loans.length === 1 ? "loan" : "loans"}
              </Text>
            )}
          </View>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            className="mt-3 text-3xl font-semibold tracking-tight text-app-text"
          >
            {selectedQuery.isPending || selectedQuery.isError ? "—" : formatMoney(outstanding)}
          </Text>
        </View>
        {!canChange && (
          <Text className="mb-4 text-xs text-app-subtle">
            Connect and finish syncing to add loans or payments.
          </Text>
        )}
        {selectedQuery.isError ? (
          <View className="items-center rounded-[22px] border border-app-border bg-app-card p-6">
            <Text className="text-sm text-red-400">Could not load loans.</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => void selectedQuery.refetch()}
              className="mt-3 rounded-xl bg-app-muted px-5 py-3"
            >
              <Text className="text-sm font-medium text-app-text">Retry</Text>
            </Pressable>
          </View>
        ) : selectedQuery.isPending ? (
          <View
            accessibilityLabel="Loading loans"
            className="rounded-[22px] border border-app-border bg-app-card py-12"
          >
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : loans.length === 0 ? (
          <View className="items-center rounded-[22px] border border-app-border bg-app-card px-6 py-12">
            <HandCoins size={32} color={colors.subtle} />
            <Text className="mt-3 text-sm text-app-subtle">
              No {kind === "taken" ? "borrowed" : "lent"} loans yet
            </Text>
          </View>
        ) : (
          <View className="gap-3">
            {loans.map((loan) => (
              <LoanRow
                key={loan.id}
                kind={kind}
                loan={loan}
                onRefresh={refreshLoans}
                onEdit={() => openEdit(kind, loan)}
                canChange={canChange}
                senderName={session?.user.name || "Kharchabaki user"}
              />
            ))}
          </View>
        )}
      </ScrollView>
      <FormSheet
        visible={showForm}
        title={editingLoan ? "Edit loan" : "Add loan"}
        onClose={() => {
          setShowForm(false);
          setShowDatePicker(false);
        }}
        disabled={createMutation.isPending}
        footer={
          <Pressable
            accessibilityRole="button"
            disabled={!canChange || createMutation.isPending}
            onPress={submitLoan}
            className={`h-12 flex-row items-center justify-center gap-2 rounded-2xl bg-app-primary ${!canChange || createMutation.isPending ? "opacity-50" : ""}`}
          >
            {createMutation.isPending ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Check size={19} color={colors.onPrimary} />
            )}
            <Text className="font-semibold text-app-on-primary">
              {editingLoan ? "Save changes" : "Save loan"}
            </Text>
          </Pressable>
        }
      >
        <LoanTabs
          kind={createKind}
          onChange={setCreateKind}
          disabled={createMutation.isPending || !!editingLoan}
        />
        <LoanField label="Amount">
          <TextInput
            accessibilityLabel="Loan amount"
            value={form.amount}
            onChangeText={(amount) => setForm({ ...form, amount })}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={colors.subtle}
            editable={!createMutation.isPending}
            className="h-14 rounded-2xl border border-app-border bg-app-bg px-4 text-xl font-semibold text-app-text"
          />
        </LoanField>
        <LoanField label={createKind === "taken" ? "Borrowed from" : "Lent to"}>
          <TextInput
            accessibilityLabel={createKind === "taken" ? "Borrowed from" : "Lent to"}
            value={form.person}
            onChangeText={(person) => setForm({ ...form, person })}
            placeholder="Person or bank"
            placeholderTextColor={colors.subtle}
            editable={!createMutation.isPending}
            maxLength={100}
            className="h-12 rounded-xl border border-app-border bg-app-bg px-4 text-app-text"
          />
        </LoanField>
        {createKind === "given" && (
          <LoanField label="Mobile number (optional)">
            <TextInput
              accessibilityLabel="Borrower mobile number"
              value={form.phoneNumber}
              onChangeText={(phoneNumber) => setForm({ ...form, phoneNumber })}
              keyboardType="phone-pad"
              placeholder="+91 98765 43210"
              placeholderTextColor={colors.subtle}
              editable={!createMutation.isPending}
              maxLength={30}
              className="h-12 rounded-xl border border-app-border bg-app-bg px-4 text-app-text"
            />
          </LoanField>
        )}
        <View className="flex-row gap-3">
          <View className="min-w-0 flex-1">
            <LoanField label="Due date">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Choose loan due date"
                disabled={createMutation.isPending}
                onPress={() => setShowDatePicker(true)}
                className="h-12 flex-row items-center gap-2 rounded-xl border border-app-border bg-app-bg px-3"
              >
                <CalendarDays size={17} color={colors.subtle} />
                <Text numberOfLines={1} className="flex-1 text-sm text-app-text">
                  {formatDateForInput(dueDate)}
                </Text>
              </Pressable>
            </LoanField>
          </View>
          <View className="w-28">
            <LoanField label="Interest (%)">
              <TextInput
                accessibilityLabel="Interest percentage"
                value={form.interest}
                onChangeText={(interest) => setForm({ ...form, interest })}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={colors.subtle}
                editable={!createMutation.isPending}
                className="h-12 rounded-xl border border-app-border bg-app-bg px-4 text-app-text"
              />
            </LoanField>
          </View>
        </View>
        {showDatePicker && (
          <DateTimePicker
            value={dueDate}
            mode="date"
            display="default"
            minimumDate={new Date()}
            onValueChange={(_event, selectedDate) => {
              setShowDatePicker(false);
              if (selectedDate) setDueDate(selectedDate);
            }}
          />
        )}
        {(formError || createMutation.isError) && (
          <Text accessibilityRole="alert" className="mt-4 text-sm text-red-400">
            {formError || createMutation.error?.message}
          </Text>
        )}
      </FormSheet>
    </View>
  );
}

function LoanTabs({
  kind,
  onChange,
  disabled = false,
}: {
  kind: LoanKind;
  onChange: (kind: LoanKind) => void;
  disabled?: boolean;
}) {
  const { colors } = usePreferences();
  return (
    <View accessibilityRole="tablist" className="flex-row gap-2 rounded-2xl bg-app-muted p-1.5">
      {(["taken", "given"] as const).map((option) => {
        const selected = kind === option;
        const Icon = option === "taken" ? ArrowDownLeft : ArrowUpRight;
        return (
          <Pressable
            key={option}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            disabled={disabled}
            onPress={() => onChange(option)}
            className={`h-12 flex-1 flex-row items-center justify-center gap-2 rounded-xl ${selected ? (option === "taken" ? "bg-amber-500" : "bg-emerald-500") : ""}`}
          >
            <Icon size={18} color={selected ? "#102018" : colors.subtle} />
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={selected ? { color: "#102018" } : undefined}
              className={`text-sm font-semibold ${selected ? "" : "text-app-subtle"}`}
            >
              {option === "taken" ? "I borrowed" : "I lent"}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function LoanRow({
  kind,
  loan,
  onRefresh,
  onEdit,
  canChange,
  senderName,
}: {
  kind: LoanKind;
  loan: TakenLoan | GivenLoan;
  onRefresh: () => void;
  onEdit: () => void;
  canChange: boolean;
  senderName: string;
}) {
  const { formatMoney, colors } = usePreferences();
  const [showPayment, setShowPayment] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [amount, setAmount] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const person = "borrowedFrom" in loan ? loan.borrowedFrom : loan.borrowerName;
  const outstanding = Math.max(0, Number(loan.totalAmount) - Number(loan.paidAmount));
  const paidProgress =
    Number(loan.totalAmount) > 0
      ? Math.min(100, (Number(loan.paidAmount) / Number(loan.totalAmount)) * 100)
      : 0;
  const paid = loan.status === "paid" || outstanding === 0;
  const accent = kind === "taken" ? "#d97706" : "#059669";
  const openSmsComposer = async () => {
    if (kind !== "given" || !("borrowerName" in loan) || !loan.phoneNumber) {
      Alert.alert("Mobile number missing", "Add a mobile number to this lent loan first.");
      return;
    }
    const body = `Hi ${loan.borrowerName}, you borrowed ${formatMoney(loan.amount)} from ${senderName}. The due date is ${formatDate(loan.dueDate)}.`;
    const separator = Platform.OS === "ios" ? "&" : "?";
    const url = `sms:${encodeURIComponent(loan.phoneNumber)}${separator}body=${encodeURIComponent(body)}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("Messaging unavailable", "No messaging app could open this message.");
    }
  };
  const deleteMutation = useMutation({
    mutationFn: () => (kind === "taken" ? deleteTakenLoan(loan.id) : deleteGivenLoan(loan.id)),
    onSuccess: onRefresh,
  });
  const confirmDelete = () => {
    setDeleteError("");
    Alert.alert(
      "Delete loan?",
      "This removes the loan and its payment history, and reverses its balance effects.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            deleteMutation.mutate(undefined, {
              onError: (error) => setDeleteError(error.message),
            }),
        },
      ]
    );
  };
  const paymentMutation = useMutation({
    mutationFn: () =>
      kind === "taken"
        ? recordTakenLoanPayment({ loanId: loan.id, amount })
        : recordGivenLoanPayment({ loanId: loan.id, amount }),
    onSuccess: () => {
      setAmount("");
      setShowPayment(false);
      onRefresh();
    },
  });
  const submitPayment = () => {
    if (!canChange || paymentMutation.isPending) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setPaymentError("Enter an amount greater than zero.");
      return;
    }
    if (value > outstanding) {
      setPaymentError(`Payment cannot exceed ${formatMoney(outstanding)}.`);
      return;
    }
    setPaymentError("");
    paymentMutation.mutate();
  };
  return (
    <View className="overflow-hidden rounded-[22px] border border-app-border bg-app-card p-4">
      <View className="flex-row items-center gap-3">
        <View
          className={`h-11 w-11 items-center justify-center rounded-2xl ${kind === "taken" ? "bg-amber-500/10" : "bg-emerald-500/10"}`}
        >
          {paid ? (
            <Check size={20} color={accent} />
          ) : kind === "taken" ? (
            <ArrowDownLeft size={20} color={accent} />
          ) : (
            <ArrowUpRight size={20} color={accent} />
          )}
        </View>
        <View className="min-w-0 flex-1">
          <Text numberOfLines={1} className="text-base font-semibold text-app-text">
            {person}
          </Text>
          <Text
            numberOfLines={1}
            className={`mt-1 text-xs ${loan.status === "overdue" && !paid ? "text-red-400" : "text-app-subtle"}`}
          >
            {paid
              ? "Paid"
              : `${loan.status === "overdue" ? "Overdue · " : "Due "}${formatDate(loan.dueDate)}`}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${expanded ? "Hide" : "Show"} loan details for ${person}`}
          accessibilityState={{ expanded }}
          onPress={() => setExpanded(!expanded)}
          className="h-11 w-11 items-center justify-center rounded-xl bg-app-muted"
        >
          {expanded ? (
            <ChevronUp size={18} color={colors.subtle} />
          ) : (
            <ChevronDown size={18} color={colors.subtle} />
          )}
        </Pressable>
      </View>
      <View className="mt-4 flex-row items-center gap-3">
        <View className="min-w-0 flex-1">
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            className="text-2xl font-semibold tracking-tight text-app-text"
          >
            {formatMoney(outstanding)}
          </Text>
          <Text numberOfLines={1} className="mt-1 text-xs text-app-subtle">
            {Math.round(paidProgress)}% repaid
          </Text>
        </View>
        {!paid && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Record payment for ${person}`}
            disabled={!canChange}
            onPress={() => {
              setPaymentError("");
              setAmount("");
              paymentMutation.reset();
              setShowPayment(true);
            }}
            className={`h-12 w-12 items-center justify-center rounded-2xl bg-app-primary ${!canChange ? "opacity-40" : ""}`}
          >
            <HandCoins size={21} color={colors.onPrimary} />
          </Pressable>
        )}
      </View>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={`Repayment progress for ${person}`}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(paidProgress) }}
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-app-muted"
      >
        <View
          className="h-full rounded-full"
          style={{ width: `${paidProgress}%`, backgroundColor: accent }}
        />
      </View>
      <View className="mt-3 flex-row justify-end gap-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Edit loan for ${person}`}
          disabled={!canChange || deleteMutation.isPending}
          onPress={onEdit}
          className={`h-10 flex-row items-center gap-2 rounded-xl bg-app-muted px-3 ${!canChange || deleteMutation.isPending ? "opacity-40" : ""}`}
        >
          <Pencil size={15} color={colors.subtle} />
          <Text className="text-xs font-medium text-app-text">Edit</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Delete loan for ${person}`}
          disabled={!canChange || deleteMutation.isPending}
          onPress={confirmDelete}
          className={`h-10 flex-row items-center gap-2 rounded-xl bg-app-muted px-3 ${!canChange || deleteMutation.isPending ? "opacity-40" : ""}`}
        >
          {deleteMutation.isPending ? (
            <ActivityIndicator size="small" color={colors.subtle} />
          ) : (
            <Trash2 size={15} color="#f87171" />
          )}
          <Text className="text-xs font-medium text-red-400">Delete</Text>
        </Pressable>
      </View>
      {deleteError && (
        <Text accessibilityRole="alert" className="mt-2 text-xs text-red-400">
          {deleteError}
        </Text>
      )}
      {expanded && (
        <View className="mt-4 gap-2 border-t border-app-border pt-3">
          <Detail label="Principal" value={formatMoney(loan.amount)} />
          {kind === "given" && "borrowerName" in loan && (
            <>
              {loan.phoneNumber && <Detail label="Mobile" value={loan.phoneNumber} />}
              <Pressable
                accessibilityRole="button"
                disabled={!loan.phoneNumber}
                onPress={() => void openSmsComposer()}
                className={`mt-2 h-11 flex-row items-center justify-center rounded-xl bg-app-muted ${!loan.phoneNumber ? "opacity-40" : ""}`}
              >
                <Text className="text-sm font-medium text-app-text">Send message</Text>
              </Pressable>
              <Text className="text-center text-xs text-app-subtle">Review and send in your messaging app.</Text>
            </>
          )}
          <Detail label="Interest" value={`${loan.interest}%`} />
          <Detail
            label="Paid"
            value={`${formatMoney(loan.paidAmount)} / ${formatMoney(loan.totalAmount)}`}
          />
        </View>
      )}
      <FormSheet
        visible={showPayment}
        title="Record payment"
        onClose={() => setShowPayment(false)}
        disabled={paymentMutation.isPending}
        footer={
          <Pressable
            accessibilityRole="button"
            disabled={!canChange || paymentMutation.isPending || !amount.trim()}
            onPress={submitPayment}
            className={`h-12 flex-row items-center justify-center gap-2 rounded-2xl bg-app-primary ${!canChange || paymentMutation.isPending || !amount.trim() ? "opacity-50" : ""}`}
          >
            {paymentMutation.isPending ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Check size={19} color={colors.onPrimary} />
            )}
            <Text className="font-semibold text-app-on-primary">Save payment</Text>
          </Pressable>
        }
      >
        <Text numberOfLines={1} className="text-lg font-semibold text-app-text">
          {person}
        </Text>
        <Text numberOfLines={1} className="mt-1 text-sm text-app-subtle">
          {formatMoney(outstanding)} remaining
        </Text>
        <LoanField label="Amount">
          <TextInput
            accessibilityLabel={`Payment amount for ${person}`}
            value={amount}
            onChangeText={(value) => {
              setAmount(value);
              setPaymentError("");
            }}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={colors.subtle}
            editable={!paymentMutation.isPending}
            className="h-14 rounded-2xl border border-app-border bg-app-bg px-4 text-xl font-semibold text-app-text"
          />
        </LoanField>
        <Pressable
          accessibilityRole="button"
          disabled={!canChange || paymentMutation.isPending}
          onPress={() => {
            setAmount(outstanding.toFixed(2));
            setPaymentError("");
          }}
          className="mt-3 self-start rounded-xl bg-app-muted px-3 py-2"
        >
          <Text className="text-xs font-medium text-app-text">Full amount</Text>
        </Pressable>
        {(paymentError || paymentMutation.isError) && (
          <Text accessibilityRole="alert" className="mt-4 text-sm text-red-400">
            {paymentError || paymentMutation.error?.message || "Unable to record payment."}
          </Text>
        )}
      </FormSheet>
    </View>
  );
}
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center gap-3">
      <Text className="text-xs text-app-subtle">{label}</Text>
      <Text
        numberOfLines={1}
        className="min-w-0 flex-1 text-right text-xs font-medium text-app-text"
      >
        {value}
      </Text>
    </View>
  );
}
function LoanField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="mt-5">
      <Text className="mb-2 text-xs font-medium text-app-subtle">{label}</Text>
      {children}
    </View>
  );
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}
function formatDateForInput(date: Date) {
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short" }).format(date);
}
function formatDateForApi(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
