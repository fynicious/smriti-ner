'use client';

import { useState } from 'react';
import { PhoneCall, X, CheckCircle2, AlertTriangle, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface ApprovedFamilyContact {
  id: string;
  name: string;
  relation: string;
  phoneNumber?: string | null;
  allowCall?: boolean;
  requireCallConfirm?: boolean;
  imageUrl?: string | null;
  imageBase64?: string | null;
  audioUrl?: string | null;
}

interface AlertDeliveryResult {
  delivered: boolean;
  smsSent: boolean;
  pushSent: boolean;
  simulated: boolean;
  deliveryStatus: string;
  message: string;
}

export function FamilyCallModal({
  isOpen,
  onClose,
  patientId,
  contacts,
}: {
  isOpen: boolean;
  onClose: () => void;
  patientId?: string | null;
  contacts: ApprovedFamilyContact[];
}) {
  const [sosState, setSosState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [alertResult, setAlertResult] = useState<AlertDeliveryResult | null>(null);
  const [confirmContact, setConfirmContact] = useState<ApprovedFamilyContact | null>(null);

  const callableContacts = contacts.filter((c) => c.allowCall && c.phoneNumber);

  const handleSendAlert = async () => {
    if (!patientId) return;
    setSosState('sending');
    setAlertResult(null);
    try {
      const res = await fetch('/api/alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, type: 'SOS' }),
      });
      if (!res.ok) {
        setSosState('error');
        return;
      }
      const data = (await res.json()) as AlertDeliveryResult;
      setAlertResult(data);
      setSosState('done');
    } catch {
      setSosState('error');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[100] bg-slate-900/65 backdrop-blur-sm flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="family-help-title"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.94 }}
          className="bg-white rounded-[32px] w-full max-w-md p-6 shadow-2xl border-2 border-rose-200 max-h-[90vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 id="family-help-title" className="text-2xl font-black text-slate-900">
              Family &amp; Emergency Help
            </h2>
            <button
              type="button"
              onClick={() => {
                setConfirmContact(null);
                onClose();
              }}
              aria-label="Close help dialog"
              className="w-14 h-14 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700"
            >
              <X size={24} />
            </button>
          </div>

          {confirmContact ? (
            <div className="bg-sky-50 border-2 border-sky-300 rounded-3xl p-5 text-center space-y-4">
              {(confirmContact.imageUrl || confirmContact.imageBase64) && (
                <img
                  src={confirmContact.imageUrl || confirmContact.imageBase64 || '/assets/ner/family.svg'}
                  alt={confirmContact.name}
                  className="w-24 h-24 rounded-full object-cover mx-auto border-4 border-white shadow-md"
                />
              )}
              <div>
                <p className="text-sm font-black uppercase tracking-widest text-sky-800">{confirmContact.relation}</p>
                <h3 className="text-2xl font-black text-slate-900 mt-1">Call {confirmContact.name}?</h3>
                <p className="text-base font-bold text-slate-700 mt-1">{confirmContact.phoneNumber}</p>
              </div>
              <div className="space-y-3">
                <a
                  href={`tel:${confirmContact.phoneNumber}`}
                  className="w-full min-h-[60px] bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xl rounded-2xl flex items-center justify-center gap-2 shadow-md"
                >
                  <PhoneCall size={22} /> Yes, Call {confirmContact.name}
                </a>
                <button
                  type="button"
                  onClick={() => setConfirmContact(null)}
                  className="w-full min-h-[56px] bg-white border-2 border-slate-300 text-slate-800 font-bold text-lg rounded-2xl"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {callableContacts.length > 0 && (
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-slate-600 mb-2">
                    Tap a Family Member to Call
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {callableContacts.map((c) => {
                      const callHref = `tel:${c.phoneNumber}`;
                      const inner = (
                        <>
                          <img
                            src={c.imageUrl || c.imageBase64 || '/assets/ner/family.svg'}
                            alt={c.name}
                            className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-sm mb-2"
                          />
                          <span className="text-base font-black text-slate-900 leading-tight">{c.name}</span>
                          <span className="text-xs font-bold text-sky-800 mt-0.5">{c.relation}</span>
                        </>
                      );
                      return c.requireCallConfirm !== false ? (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setConfirmContact(c)}
                          className="min-h-[120px] p-3 rounded-3xl bg-sky-50 hover:bg-sky-100 border-2 border-sky-200 flex flex-col items-center justify-center text-center transition-colors"
                        >
                          {inner}
                        </button>
                      ) : (
                        <a
                          key={c.id}
                          href={callHref}
                          className="min-h-[120px] p-3 rounded-3xl bg-sky-50 hover:bg-sky-100 border-2 border-sky-200 flex flex-col items-center justify-center text-center transition-colors"
                        >
                          {inner}
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <a
                  href="tel:112"
                  className="min-h-[64px] px-3 bg-rose-600 hover:bg-rose-700 text-white font-black text-lg rounded-2xl flex items-center justify-center gap-2 shadow-sm"
                >
                  <PhoneCall size={20} /> Call 112
                </a>
                <a
                  href="tel:108"
                  className="min-h-[64px] px-3 bg-slate-900 hover:bg-slate-800 text-white font-black text-lg rounded-2xl flex items-center justify-center gap-2 shadow-sm"
                >
                  <PhoneCall size={20} /> 108 Ambulance
                </a>
              </div>

              <div className="border-t border-slate-200 pt-4 space-y-3">
                {sosState === 'done' && alertResult ? (
                  <div
                    className={`p-4 rounded-2xl border-2 text-left ${
                      alertResult.delivered
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                        : 'bg-amber-50 border-amber-300 text-amber-950'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      {alertResult.delivered ? (
                        <CheckCircle2 className="shrink-0 text-emerald-600 mt-0.5" size={22} />
                      ) : (
                        <AlertTriangle className="shrink-0 text-amber-700 mt-0.5" size={22} />
                      )}
                      <div>
                        <p className="font-black text-base">
                          {alertResult.delivered
                            ? 'Caregiver SMS Confirmed'
                            : 'Alert Logged Only — Not Dispatched Externally'}
                        </p>
                        <p className="text-sm font-medium mt-1">{alertResult.message}</p>
                      </div>
                    </div>
                  </div>
                ) : sosState === 'error' ? (
                  <div className="p-4 rounded-2xl border-2 bg-rose-50 border-rose-300 text-rose-900 flex items-start gap-2.5">
                    <ShieldAlert className="shrink-0 text-rose-600 mt-0.5" size={22} />
                    <div>
                      <p className="font-black text-base">Could Not Reach Alert Server</p>
                      <p className="text-sm font-medium mt-1">
                        Your device could not confirm an alert right now. Use Call 112 or tap a family contact above.
                      </p>
                    </div>
                  </div>
                ) : null}

                {patientId && sosState !== 'done' && (
                  <button
                    type="button"
                    disabled={sosState === 'sending'}
                    onClick={handleSendAlert}
                    className="w-full min-h-[58px] bg-amber-100 hover:bg-amber-200 border-2 border-amber-400 text-amber-950 font-black text-base rounded-2xl transition-colors disabled:opacity-50"
                  >
                    {sosState === 'sending' ? 'Sending Alert...' : 'Send Help Signal to Caregiver Log'}
                  </button>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
