'use client';

import Link from 'next/link';
import { ArrowDownCircle, ArrowUpCircle, Wallet, Clock, TrendingUp, TrendingDown, DollarSign, Target, Inbox } from 'lucide-react';

export default function SummaryCards({ summary, runway, numberFmt, untransferredSummary }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
      <Card>
        <div className="flex items-start justify-between mb-3">
          <IconWrap className="from-green-50 to-emerald-50"><ArrowDownCircle className="w-6 h-6 text-green-600" /></IconWrap>
          <TrendingUp className="w-5 h-5 text-green-600" />
        </div>
        <Value>{numberFmt(summary.received)}</Value>
        <Label>Total Received</Label>
      </Card>

      <Card>
        <div className="flex items-start justify-between mb-3">
          <IconWrap className="from-red-50 to-orange-50"><ArrowUpCircle className="w-6 h-6 text-red-600" /></IconWrap>
          <TrendingDown className="w-5 h-5 text-red-600" />
        </div>
        <Value>{numberFmt(summary.spent)}</Value>
        <Label>Total Spent</Label>
      </Card>

      <Card>
        <div className="flex items-start justify-between mb-3">
          <IconWrap className="from-indigo-50 to-blue-50"><Wallet className="w-6 h-6 text-indigo-600" /></IconWrap>
          <DollarSign className="w-5 h-5 text-indigo-600" />
        </div>
        <Value>{numberFmt(summary.balance)}</Value>
        <Label>Current Balance</Label>
      </Card>

      <Card>
        <div className="flex items-start justify-between mb-3">
          <IconWrap className="from-purple-50 to-pink-50"><Clock className="w-6 h-6 text-purple-600" /></IconWrap>
          <Target className="w-5 h-5 text-purple-600" />
        </div>
        <Value>{runway ? `${runway} months` : 'N/A'}</Value>
        <Label>Estimated Runway</Label>
      </Card>

      {untransferredSummary && (
        <Link href="/organization/untransferred">
          <Card>
            <div className="flex items-start justify-between mb-3">
              <IconWrap className="from-teal-50 to-emerald-50"><Inbox className="w-6 h-6 text-teal-600" /></IconWrap>
              <TrendingUp className="w-5 h-5 text-teal-600" />
            </div>
            <Value>{numberFmt(untransferredSummary.remaining || 0)}</Value>
            <Label>Untransferred Funds</Label>
          </Card>
        </Link>
      )}
    </div>
  );
}

function Card({ children }) {
  return (
    <div className="bg-white rounded-2xl p-6 border-2 border-transparent hover:border-slate-200 transition-all shadow-sm">
      {children}
    </div>
  );
}

function IconWrap({ children, className = '' }) {
  return (
    <div className={`p-3 rounded-xl bg-gradient-to-br ${className}`}>{children}</div>
  );
}

function Value({ children }) {
  return <h3 className="text-2xl font-bold text-slate-900">{children}</h3>;
}

function Label({ children }) {
  return <p className="text-sm text-slate-600 mt-1">{children}</p>;
}
