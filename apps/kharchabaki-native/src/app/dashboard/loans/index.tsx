import { type JSX, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { ArrowDownLeft, ArrowUpRight, HandCoins } from "lucide-react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import DateTimePicker from "@react-native-community/datetimepicker";

import {
  ApiResponse,
  createGivenLoan,
  createTakenLoan,
  getGivenLoans,
  getTakenLoans,
  recordGivenLoanPayment,
  recordTakenLoanPayment,
  type GivenLoan,
  type TakenLoan,
} from "@/lib/loan";

type LoanKind = "taken" | "given";

const initialForm = {
  amount: "",
  person: "",
  dueDate: "",
  interest: "0.00",
};

export default function Loans(): JSX.Element {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dueDate, setDueDate] = useState(new Date());
  const queryClient = useQueryClient();

  const [kind, setKind] = useState<LoanKind>("taken");
  const [form, setForm] = useState(initialForm);

  const takenLoansQuery = useQuery({
    queryKey: ["loans", "taken"],
    queryFn: getTakenLoans,
  });

  const givenLoansQuery = useQuery({
    queryKey: ["loans", "given"],
    queryFn: getGivenLoans,
  });

  const refreshLoans = () => {
    queryClient.invalidateQueries({
      queryKey: ["loans"],
    });

    queryClient.invalidateQueries({
      queryKey: ["balance"],
    });

    queryClient.invalidateQueries({
      queryKey: ["dashboard-summary"],
    });
  };

  const createMutation = useMutation<ApiResponse<TakenLoan> | ApiResponse<GivenLoan>, Error>({
    mutationFn: () => {
      if (kind === "taken") {
        return createTakenLoan({
          amount: form.amount,
          borrowedFrom: form.person,
          dueDate: form.dueDate,
          interest: form.interest,
        });
      }

      return createGivenLoan({
        amount: form.amount,
        borrowerName: form.person,
        dueDate: form.dueDate,
        interest: form.interest,
      });
    },

    onSuccess: () => {
      setForm(initialForm);
      refreshLoans();
    },
  });

  const takenLoans = takenLoansQuery.data?.data ?? [];
  const givenLoans = givenLoansQuery.data?.data ?? [];

  const isLoading = takenLoansQuery.isPending || givenLoansQuery.isPending;

  const hasError = takenLoansQuery.isError || givenLoansQuery.isError;

  const submitLoan = () => {
    if (!form.amount || !form.person || !form.dueDate || !form.interest) {
      return;
    }

    createMutation.mutate();
  };

  return (
    <View className="flex-1 bg-black">
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="px-5 pb-32 pt-6"
      >
        {/* Header */}

        <View className="mb-7">
          <Text className="text-3xl font-semibold tracking-tight text-white">Loans</Text>

          <Text className="mt-1 text-sm text-zinc-500">
            Track money you borrow and lend, including repayments.
          </Text>
        </View>

        {/* Add Loan */}

        <View className="rounded-[22px] border border-zinc-900 bg-[#050604] p-5">
          <Text className="text-lg font-medium text-white">Add a loan</Text>

          {/* Loan type */}

          <View className="mt-5 flex-row rounded-xl bg-zinc-900 p-1">
            <Pressable
              onPress={() => setKind("taken")}
              className={`flex-1 items-center rounded-lg py-3 ${
                kind === "taken" ? "bg-zinc-700" : ""
              }`}
            >
              <Text className={kind === "taken" ? "font-medium text-white" : "text-zinc-500"}>
                I borrowed
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setKind("given")}
              className={`flex-1 items-center rounded-lg py-3 ${
                kind === "given" ? "bg-zinc-700" : ""
              }`}
            >
              <Text className={kind === "given" ? "font-medium text-white" : "text-zinc-500"}>
                I lent
              </Text>
            </Pressable>
          </View>

          {/* Amount */}

          <LoanField label="Amount">
            <TextInput
              value={form.amount}
              onChangeText={(value) =>
                setForm({
                  ...form,
                  amount: value,
                })
              }
              keyboardType="decimal-pad"
              placeholder="5000"
              placeholderTextColor="#52525b"
              className="h-12 rounded-xl border border-zinc-800 bg-[#0b0d09] px-4 text-white"
            />
          </LoanField>

          {/* Person */}

          <LoanField label={kind === "taken" ? "Borrowed from" : "Borrower name"}>
            <TextInput
              value={form.person}
              onChangeText={(value) =>
                setForm({
                  ...form,
                  person: value,
                })
              }
              placeholder={kind === "taken" ? "Bank or person" : "Person's name"}
              placeholderTextColor="#52525b"
              maxLength={100}
              className="h-12 rounded-xl border border-zinc-800 bg-[#0b0d09] px-4 text-white"
            />
          </LoanField>

          {/* Due date */}

          <LoanField label="Due date">
            <Pressable
              onPress={() => setShowDatePicker(true)}
              className="h-12 flex-row items-center justify-between rounded-xl border border-zinc-800 bg-[#0b0d09] px-4"
            >
              <Text className="text-white">{formatDateForInput(dueDate)}</Text>

              <Text className="text-zinc-500">Select</Text>
            </Pressable>

            {showDatePicker && (
              <DateTimePicker
                value={dueDate}
                mode="date"
                display="default"
                minimumDate={new Date()}
                onValueChange={(event, selectedDate) => {
                  setShowDatePicker(false);

                  if (!selectedDate) {
                    return;
                  }

                  setDueDate(selectedDate);

                  setForm({
                    ...form,
                    dueDate: formatDateForApi(selectedDate),
                  });
                }}
              />
            )}
          </LoanField>
          {/* Interest */}

          <LoanField label="Interest (%)">
            <TextInput
              value={form.interest}
              onChangeText={(value) =>
                setForm({
                  ...form,
                  interest: value,
                })
              }
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="#52525b"
              className="h-12 rounded-xl border border-zinc-800 bg-[#0b0d09] px-4 text-white"
            />
          </LoanField>

          {/* Submit */}

          <Pressable
            disabled={createMutation.isPending}
            onPress={submitLoan}
            className={`mt-5 h-12 items-center justify-center rounded-xl ${
              createMutation.isPending ? "bg-lime-900" : "bg-lime-500"
            }`}
          >
            {createMutation.isPending ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text className="font-semibold text-black">
                Add {kind === "taken" ? "borrowed" : "given"} loan
              </Text>
            )}
          </Pressable>

          {createMutation.isError && (
            <Text className="mt-3 text-sm text-red-400">
              Unable to create the loan. Please check the details and try again.
            </Text>
          )}
        </View>

        {/* Loan lists */}

        <View className="mt-6">
          {hasError ? (
            <View className="rounded-[22px] border border-zinc-900 bg-[#050604] px-5 py-12">
              <Text className="text-center text-sm text-red-400">Failed to load loans.</Text>
            </View>
          ) : isLoading ? (
            <View className="rounded-[22px] border border-zinc-900 bg-[#050604] py-12">
              <ActivityIndicator color="#ffffff" />

              <Text className="mt-3 text-center text-sm text-zinc-500">Loading loans...</Text>
            </View>
          ) : (
            <>
              <LoanList kind="taken" loans={takenLoans} onRefresh={refreshLoans} />

              <LoanList kind="given" loans={givenLoans} onRefresh={refreshLoans} />
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function LoanList({
  kind,
  loans,
  onRefresh,
}: {
  kind: LoanKind;
  loans: TakenLoan[] | GivenLoan[];
  onRefresh: () => void;
}) {
  const isTaken = kind === "taken";

  return (
    <View className="mb-5 overflow-hidden rounded-[22px] border border-zinc-900 bg-[#050604]">
      {/* Header */}

      <View className="flex-row items-center border-b border-zinc-900 p-5">
        <View
          className={`h-10 w-10 items-center justify-center rounded-xl ${
            isTaken ? "bg-amber-500/10" : "bg-emerald-500/10"
          }`}
        >
          {isTaken ? (
            <ArrowDownLeft size={19} color="#f59e0b" />
          ) : (
            <ArrowUpRight size={19} color="#10b981" />
          )}
        </View>

        <Text className="ml-3 text-base font-medium text-white">
          {isTaken ? "Money borrowed" : "Money lent"}
        </Text>
      </View>

      {/* Empty */}

      {loans.length === 0 ? (
        <View className="items-center justify-center px-6 py-12">
          <HandCoins size={22} color="#52525b" />

          <Text className="mt-3 text-sm text-zinc-500">
            No {isTaken ? "borrowed" : "given"} loans yet.
          </Text>
        </View>
      ) : (
        <View>
          {loans.map((loan) => (
            <LoanRow key={loan.id} kind={kind} loan={loan} onRefresh={onRefresh} />
          ))}
        </View>
      )}
    </View>
  );
}

function LoanRow({
  kind,
  loan,
  onRefresh,
}: {
  kind: LoanKind;
  loan: TakenLoan | GivenLoan;
  onRefresh: () => void;
}) {
  const [amount, setAmount] = useState("");

  const isTaken = kind === "taken";

  const person = "borrowedFrom" in loan ? loan.borrowedFrom : loan.borrowerName;

  const outstanding = Number(loan.totalAmount) - Number(loan.paidAmount);

  const paymentMutation = useMutation({
    mutationFn: () =>
      isTaken
        ? recordTakenLoanPayment({
            loanId: loan.id,
            amount,
          })
        : recordGivenLoanPayment({
            loanId: loan.id,
            amount,
          }),

    onSuccess: () => {
      setAmount("");
      onRefresh();
    },
  });

  const submitPayment = () => {
    const value = Number(amount);

    if (!value || value <= 0) {
      return;
    }

    if (value > outstanding) {
      return;
    }

    paymentMutation.mutate();
  };

  return (
    <View className="border-b border-zinc-900 p-5">
      {/* Top */}

      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <Text numberOfLines={1} className="text-base font-medium text-white">
            {person}
          </Text>

          <Text className="mt-1 text-xs text-zinc-500">
            Due {formatDate(loan.dueDate)} · {loan.interest}% interest
          </Text>
        </View>

        {/* Status */}

        <View
          className={`rounded-full px-3 py-1 ${
            loan.status === "paid"
              ? "bg-emerald-500/10"
              : loan.status === "overdue"
                ? "bg-red-500/10"
                : "bg-amber-500/10"
          }`}
        >
          <Text
            className={`text-xs font-medium ${
              loan.status === "paid"
                ? "text-emerald-400"
                : loan.status === "overdue"
                  ? "text-red-400"
                  : "text-amber-400"
            }`}
          >
            {loan.status}
          </Text>
        </View>
      </View>

      {/* Amount */}

      <View className="mt-5">
        <Text className="text-xs text-zinc-500">Outstanding</Text>

        <Text className="mt-1 text-xl font-semibold text-white">{formatMoney(outstanding)}</Text>

        <Text className="mt-1 text-xs text-zinc-600">
          of {formatMoney(Number(loan.totalAmount))}
        </Text>
      </View>

      {/* Payment */}

      {loan.status !== "paid" && (
        <View className="mt-5">
          <Text className="mb-2 text-xs font-medium text-zinc-400">Record payment</Text>

          <View className="flex-row">
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="Payment amount"
              placeholderTextColor="#52525b"
              className="h-11 flex-1 rounded-xl border border-zinc-800 bg-[#0b0d09] px-3 text-white"
            />

            <Pressable
              disabled={paymentMutation.isPending || !amount}
              onPress={submitPayment}
              className={`ml-2 h-11 w-24 items-center justify-center rounded-xl ${
                paymentMutation.isPending || !amount ? "bg-zinc-800" : "bg-lime-500"
              }`}
            >
              {paymentMutation.isPending ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text className="text-sm font-semibold text-black">Record</Text>
              )}
            </Pressable>
          </View>

          {paymentMutation.isError && (
            <Text className="mt-2 text-xs text-red-400">Unable to record payment.</Text>
          )}
        </View>
      )}
    </View>
  );
}

function LoanField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="mt-4">
      <Text className="mb-2 text-sm font-medium text-white">{label}</Text>

      {children}
    </View>
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatDateForInput(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateForApi(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}