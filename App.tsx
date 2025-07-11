import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Sun, Battery, TrendingUp, FileText, AlertCircle, Trash2, PlusCircle, Download, XCircle, Wand2, Upload } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Bill, Tier, SeasonalAnalysis, SystemRecommendation, FinancialAnalysis } from './types';

// Constants
const UAE_SEASONAL_FACTORS: { [key: string]: number } = {
  'January': 0.75, 'February': 0.70, 'March': 0.80, 'April': 0.95,
  'May': 1.15, 'June': 1.35, 'July': 1.50, 'August': 1.45,
  'September': 1.25, 'October': 1.05, 'November': 0.85, 'December': 0.80,
};
const MONTHS: string[] = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Main App Component
const App: React.FC = () => {
  // === STATE MANAGEMENT ===
  // Project Configuration
  const [authority, setAuthority] = useState<string>('DEWA');
  const [batteryEnabled, setBatteryEnabled] = useState<boolean>(false);
  const [projectName, setProjectName] = useState<string>('');
  const [location, setLocation] = useState<string>('Dubai, UAE');

  // Bill Inputs
  const [bills, setBills] = useState<Bill[]>([]);
  const [billInput, setBillInput] = useState<string>('');
  const [rateStructure, setRateStructure] = useState<string>('flat');
  const [electricityRate, setElectricityRate] = useState<number>(0.5);
  const [tiers, setTiers] = useState<Tier[]>([
    { from: 0, to: 2000, rate: 0.3 },
    { from: 2001, to: 4000, rate: 0.38 },
    { from: 4001, to: 6000, rate: 0.44 },
    { from: 6001, to: Infinity, rate: 0.5 }
  ]);

  // System Parameters
  const [daytimeConsumption, setDaytimeConsumption] = useState<number>(60);
  const [availableSpace, setAvailableSpace] = useState<number>(100);
  const [peakSunHours, setPeakSunHours] = useState<number>(5.5);
  const [systemEfficiency, setSystemEfficiency] = useState<number>(85);
  const [panelWattage, setPanelWattage] = useState<number>(550);

  // Financial Inputs
  const [systemCost, setSystemCost] = useState<string>('');

  // Calculated Outputs
  const [seasonalAnalysis, setSeasonalAnalysis] = useState<SeasonalAnalysis>({ summerAvg: 0, winterAvg: 0, spikePercentage: 0, baseLoad: 0, coolingLoad: 0, dailyAvg: 0 });
  const [systemRecommendation, setSystemRecommendation] = useState<SystemRecommendation>({ systemSize: 0, panelCount: 0, spaceRequired: 0, annualProduction: 0, inverterCapacity: 0, batteryCapacity: 0, summerCoverage: 0, winterCoverage: 0, annualCoverage: 0 });
  const [financialAnalysis, setFinancialAnalysis] = useState<FinancialAnalysis>({ annualSavings: 0, paybackPeriod: 0, roi25Year: 0, netMeteringCredits: 0, roiPercentage: 0 });

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);

  // === CALCULATION LOGIC ===
  const calculateBillAmount = useCallback((consumption: number): number => {
    if (consumption <= 0) return 0;
    if (rateStructure === 'flat') {
      return consumption * electricityRate;
    }
    let totalAmount = 0;
    let remainingConsumption = consumption;
    // Ensure tiers are sorted by 'from' to calculate correctly
    const sortedTiers = [...tiers].sort((a, b) => a.from - b.from);
    for (const tier of sortedTiers) {
      if (remainingConsumption <= 0) break;
      const tierStart = tier.from > 0 ? tier.from -1 : 0;
      const tierRange = tier.to === Infinity ? remainingConsumption : tier.to - tierStart;
      const consumptionInTier = Math.min(remainingConsumption, tierRange);
      totalAmount += Math.max(0, consumptionInTier) * tier.rate;
      remainingConsumption -= consumptionInTier;
    }
    return totalAmount;
  }, [rateStructure, electricityRate, tiers]);

  // === BILL & TIER MANAGEMENT ===
  const addTier = () => {
    const lastTier = tiers[tiers.length - 1];
    const newFrom = lastTier.to === Infinity ? (lastTier.from + 2000) : (lastTier.to + 1);
    setTiers([...tiers.slice(0, -1), { from: lastTier.from, to: newFrom - 1, rate: lastTier.rate }, { from: newFrom, to: Infinity, rate: parseFloat((lastTier.rate + 0.05).toFixed(2)) }]);
  };

  const updateTier = (index: number, field: keyof Tier, value: string) => {
    const newTiers = [...tiers];
    const numValue = field === 'rate' ? parseFloat(value) : parseInt(value, 10);
    if (isNaN(numValue)) return;

    if (field === 'to' && index < tiers.length - 1) {
      newTiers[index + 1].from = numValue + 1;
    }
    (newTiers[index] as any)[field] = numValue;
    setTiers(newTiers);
  };
  
  const removeTier = (indexToRemove: number) => {
    if (tiers.length <= 1) return; // Cannot remove the last tier
    let newTiers = tiers.filter((_, index) => index !== indexToRemove);

    // After removing, fix the chain to ensure no gaps or overlaps.
    for (let i = 0; i < newTiers.length; i++) {
        if (i === 0) {
            newTiers[i].from = 0; // First tier always starts at 0
        } else {
            newTiers[i].from = newTiers[i-1].to + 1;
        }

        if (i === newTiers.length - 1) {
            newTiers[i].to = Infinity; // Last tier always ends at Infinity
        }
    }
    setTiers(newTiers);
  };

  const parseAndAddBills = useCallback(() => {
    const entries = billInput.split(/[,;\n]+/).filter(e => e.trim());
    if (entries.length === 0) return;
    
    let currentBills = [...bills];
    const existingMonths = new Set(currentBills.map(b => b.month));

    entries.forEach(entry => {
      const match = entry.trim().match(/^(\w+)[\s-]*(\d+(\.\d+)?)$/);
      if (match) {
        const [_, monthStr, consumptionStr] = match;
        const consumption = parseFloat(consumptionStr);
        const monthLower = monthStr.toLowerCase();
        
        const monthIndex = MONTHS.findIndex(m => m.toLowerCase().startsWith(monthLower));
        if (monthIndex !== -1) {
          const month = MONTHS[monthIndex];
          if (consumption > 0 && !existingMonths.has(month)) {
            currentBills.push({ month, consumption, amount: calculateBillAmount(consumption), isEstimated: false });
            existingMonths.add(month);
          }
        }
      }
    });

    setBills(currentBills.sort((a, b) => MONTHS.indexOf(a.month) - MONTHS.indexOf(b.month)));
    setBillInput('');
  }, [billInput, bills, calculateBillAmount]);

  const removeBill = (index: number) => {
    setBills(prev => prev.filter((_, i) => i !== index));
  };
  
  const handleEstimateFromPartialData = useCallback(() => {
    if (bills.length === 0 || bills.length >= 12) return;
    const totalBaseConsumption = bills.reduce((sum, bill) => sum + (bill.consumption / UAE_SEASONAL_FACTORS[bill.month]), 0);
    const normalizedAvgConsumption = totalBaseConsumption / bills.length;
    const userProvidedMonths = new Set(bills.map(b => b.month));
    const estimatedBills = MONTHS
      .filter(month => !userProvidedMonths.has(month))
      .map(month => {
        const estimatedConsumption = Math.round(normalizedAvgConsumption * UAE_SEASONAL_FACTORS[month]);
        return { month, consumption: estimatedConsumption, amount: calculateBillAmount(estimatedConsumption), isEstimated: true };
      });
    setBills([...bills.map(b => ({ ...b, isEstimated: false })), ...estimatedBills].sort((a, b) => MONTHS.indexOf(a.month) - MONTHS.indexOf(b.month)));
  }, [bills, calculateBillAmount]);


  // === USE EFFECT HOOKS ===
  useEffect(() => { // Seasonal Analysis
    if (bills.length === 0) {
      setSeasonalAnalysis({ summerAvg: 0, winterAvg: 0, spikePercentage: 0, baseLoad: 0, coolingLoad: 0, dailyAvg: 0 });
      return;
    }
    const summerMonths = ['May', 'June', 'July', 'August', 'September'];
    const summerBills = bills.filter(bill => summerMonths.includes(bill.month));
    const winterBills = bills.filter(bill => !summerMonths.includes(bill.month));
    const summerAvg = summerBills.length > 0 ? summerBills.reduce((sum, bill) => sum + bill.consumption, 0) / summerBills.length : 0;
    const winterAvg = winterBills.length > 0 ? winterBills.reduce((sum, bill) => sum + bill.consumption, 0) / winterBills.length : 0;
    const totalAvg = bills.reduce((sum, bill) => sum + bill.consumption, 0) / bills.length;
    setSeasonalAnalysis({
      summerAvg: Math.round(summerAvg),
      winterAvg: Math.round(winterAvg),
      spikePercentage: winterAvg > 0 ? Math.round(((summerAvg - winterAvg) / winterAvg) * 100) : 0,
      baseLoad: Math.round(winterAvg),
      coolingLoad: Math.round(summerAvg - winterAvg),
      dailyAvg: Math.round(totalAvg / 30)
    });
  }, [bills]);

  useEffect(() => { // System Recommendation
    if (bills.length === 0) {
        setSystemRecommendation({ systemSize: 0, panelCount: 0, spaceRequired: 0, annualProduction: 0, inverterCapacity: 0, batteryCapacity: 0, summerCoverage: 0, winterCoverage: 0, annualCoverage: 0 });
        return;
    }
    const avgMonthlyConsumption = bills.reduce((sum, bill) => sum + bill.consumption, 0) / bills.length;
    const avgDailyConsumption = avgMonthlyConsumption / 30;
    let targetConsumption = avgDailyConsumption;
    if (authority === 'FEWA' && !batteryEnabled) {
      targetConsumption = avgDailyConsumption * (daytimeConsumption / 100);
    }
    const safePeakSunHours = peakSunHours > 0 ? peakSunHours : 1;
    const systemSize = (targetConsumption / (safePeakSunHours * (systemEfficiency / 100)));
    const panelCount = panelWattage > 0 ? Math.ceil((systemSize * 1000) / panelWattage) : 0;
    const actualSystemSize = (panelCount * panelWattage) / 1000;
    const annualProduction = actualSystemSize * safePeakSunHours * 365 * (systemEfficiency / 100);
    const inverterCapacity = Math.round((actualSystemSize / 1.15) * 10) / 10;
    let batteryCapacity = 0;
    if (authority === 'FEWA' && batteryEnabled) {
      const nightConsumption = avgDailyConsumption * (1 - daytimeConsumption / 100);
      batteryCapacity = Math.ceil(nightConsumption * 1.2);
    }
    const monthlyProduction = annualProduction / 12;
    setSystemRecommendation({
      systemSize: Math.round(actualSystemSize * 10) / 10,
      panelCount,
      spaceRequired: Math.round(panelCount * 2.1),
      annualProduction: Math.round(annualProduction),
      inverterCapacity, batteryCapacity,
      summerCoverage: Math.min(Math.round(seasonalAnalysis.summerAvg > 0 ? (monthlyProduction / seasonalAnalysis.summerAvg) * 100 : 100), 100),
      winterCoverage: Math.min(Math.round(seasonalAnalysis.winterAvg > 0 ? (monthlyProduction / seasonalAnalysis.winterAvg) * 100 : 100), 100),
      annualCoverage: Math.min(Math.round(avgMonthlyConsumption > 0 ? (annualProduction / (avgMonthlyConsumption * 12)) * 100 : 100), 100)
    });
  }, [bills, authority, batteryEnabled, daytimeConsumption, peakSunHours, systemEfficiency, panelWattage, seasonalAnalysis]);

  useEffect(() => { // Financial Analysis
    if (!systemCost || bills.length === 0 || systemRecommendation.annualProduction === 0) {
      setFinancialAnalysis({ annualSavings: 0, paybackPeriod: 0, roi25Year: 0, netMeteringCredits: 0, roiPercentage: 0 });
      return;
    }

    const initialInvestment = parseFloat(systemCost);
    if (isNaN(initialInvestment) || initialInvestment <= 0) return;

    const DEGRADATION_RATE = 0.005, ELECTRICITY_ESCALATION = 0.02, SYSTEM_LIFESPAN = 25;
    const maintenanceCostPerYear = initialInvestment * 0.01;
    
    const consumptionByMonth = MONTHS.reduce((acc, month) => {
        const bill = bills.find(b => b.month === month);
        acc[month] = bill ? bill.consumption : (bills.reduce((s, b) => s + b.consumption, 0) / bills.length);
        return acc;
    }, {} as {[key: string]: number});

    let cumulativeCashFlow = -initialInvestment, paybackYears = 0, firstYearSavings = 0;
    let netMeteringCreditsKwh = 0, endOfYear1CreditsKwh = 0;

    for (let year = 1; year <= SYSTEM_LIFESPAN; year++) {
      let yearlySavings = 0;
      const degradationFactor = Math.pow(1 - DEGRADATION_RATE, year - 1);
      const escalationFactor = Math.pow(1 + ELECTRICITY_ESCALATION, year - 1);

      for (const month of MONTHS) {
        const monthlyConsumption = consumptionByMonth[month];
        const monthlyProduction = (systemRecommendation.annualProduction / 12) * degradationFactor;
        const originalBill = calculateBillAmount(monthlyConsumption) * escalationFactor;
        let newBill = 0;

        if (authority === 'DEWA') {
            const netKwh = monthlyProduction - monthlyConsumption;
            if (netKwh >= 0) {
                netMeteringCreditsKwh += netKwh;
                newBill = 0;
            } else {
                const kwhToDraw = Math.abs(netKwh);
                const drawnFromCredits = Math.min(kwhToDraw, netMeteringCreditsKwh);
                netMeteringCreditsKwh -= drawnFromCredits;
                newBill = calculateBillAmount(kwhToDraw - drawnFromCredits) * escalationFactor;
            }
        } else { // FEWA
            const selfConsumptionRate = batteryEnabled ? 0.95 : (daytimeConsumption / 100);
            const savedKwh = Math.min(monthlyProduction * selfConsumptionRate, monthlyConsumption);
            newBill = calculateBillAmount(monthlyConsumption - savedKwh) * escalationFactor;
        }
        yearlySavings += (originalBill - newBill);
      }
      if (year === 1) {
        firstYearSavings = yearlySavings;
        endOfYear1CreditsKwh = netMeteringCreditsKwh;
      }
      const yearlyNetCashFlow = yearlySavings - maintenanceCostPerYear;
      const prevCumulative = cumulativeCashFlow;
      cumulativeCashFlow += yearlyNetCashFlow;
      if (paybackYears === 0 && cumulativeCashFlow > 0) {
        paybackYears = yearlyNetCashFlow > 0 ? (year - 1) + Math.abs(prevCumulative) / yearlyNetCashFlow : 0;
      }
    }
    const totalConsumption = bills.reduce((sum, b) => sum + b.consumption, 0);
    const totalAmount = bills.reduce((sum, b) => sum + b.amount, 0);
    const avgTariff = totalConsumption > 0 ? totalAmount / totalConsumption : electricityRate;

    setFinancialAnalysis({
      annualSavings: Math.round(firstYearSavings),
      paybackPeriod: paybackYears > 0 ? Math.round(paybackYears * 10) / 10 : 0,
      roi25Year: Math.round(cumulativeCashFlow),
      netMeteringCredits: Math.round(endOfYear1CreditsKwh * avgTariff),
      roiPercentage: Math.round((cumulativeCashFlow / initialInvestment) * 100)
    });
  }, [systemCost, bills, systemRecommendation, authority, batteryEnabled, daytimeConsumption, calculateBillAmount, electricityRate]);

  // === RENDER FUNCTIONS ===
  const renderHeader = () => (
    <header className="bg-[#2c2b88] text-white py-6 px-6 mb-6 shadow-md">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center">
            <Sun className="w-10 h-10 mr-3 text-[#fac65b]" />
            <div>
              <h1 className="text-3xl font-bold">Solar Oasis Calculator</h1>
              <p className="text-sm opacity-80">Professional Solar Solutions - solaroasis.ae</p>
            </div>
          </div>
      </div>
    </header>
  );

  const renderProjectConfig = () => (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
      <h2 className="text-xl font-semibold mb-4 text-[#2c2b88]">Project Configuration</h2>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1 text-[#2c2b88]">Authority</label>
          <div className="flex gap-2">
            {['DEWA', 'FEWA'].map(auth => (
              <button key={auth} onClick={() => { setAuthority(auth); if (auth === 'DEWA') setBatteryEnabled(false); }}
                className={`px-4 py-2 rounded transition-colors w-full ${authority === auth ? 'bg-[#2c2b88] text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
                {auth}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-[#2c2b88]">Battery Storage</label>
          <button onClick={() => setBatteryEnabled(!batteryEnabled)} disabled={authority === 'DEWA'}
            className={`px-4 py-2 rounded flex items-center justify-center gap-2 transition-colors w-full ${batteryEnabled ? 'bg-[#fac65b] text-[#2c2b88]' : 'bg-gray-200 text-gray-700'} ${authority === 'DEWA' ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-300'}`}>
            <Battery className="w-4 h-4" />
            {batteryEnabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>
        <div>
          <label htmlFor="project-name" className="block text-sm font-medium mb-1 text-[#2c2b88]">Project Name</label>
          <input type="text" id="project-name" value={projectName} onChange={(e) => setProjectName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2c2b88]" placeholder="e.g. Villa Solar Project" />
        </div>
        <div>
          <label htmlFor="location" className="block text-sm font-medium mb-1 text-[#2c2b88]">Location</label>
          <input type="text" id="location" value={location} onChange={(e) => setLocation(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2c2b88]" />
        </div>
      </div>
    </div>
  );

  const renderBillAnalysis = () => (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
      <h2 className="text-xl font-semibold mb-4 text-[#2c2b88]">Electricity Bill Analysis</h2>
      {/* Bill Entry and Rate Structure */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <label htmlFor="bill-input" className="block text-sm font-medium mb-1 text-[#2c2b88]">Quick Bill Entry (e.g., Jan-2000)</label>
          <textarea id="bill-input" value={billInput} onChange={(e) => setBillInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), parseAndAddBills())}
            className="w-full px-3 py-2 border border-gray-300 rounded-md h-28 focus:outline-none focus:ring-2 focus:ring-[#2c2b88]"
            placeholder="Enter bills like:&#10;Jan-2000&#10;Feb-2100&#10;&#10;Or comma-separated: Mar-1950, Apr-1980" />
          <button onClick={parseAndAddBills} className="mt-2 w-full px-4 py-2 text-white font-semibold rounded-md transition-colors bg-[#fac65b] hover:bg-[#f9b842] text-[#2c2b88]">
            Add Bills
          </button>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-[#2c2b88]">Rate Structure</label>
          <div className="flex gap-2 mb-2">
            <button onClick={() => setRateStructure('flat')} className={`px-3 py-1 rounded text-sm transition-colors w-1/2 ${rateStructure === 'flat' ? 'bg-[#2c2b88] text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>Flat</button>
            <button onClick={() => setRateStructure('tiered')} className={`px-3 py-1 rounded text-sm transition-colors w-1/2 ${rateStructure === 'tiered' ? 'bg-[#2c2b88] text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>Tiered</button>
          </div>
          {rateStructure === 'flat' ? (
            <div>
              <label htmlFor="flat-rate" className="block text-xs font-medium mb-1 text-[#2c2b88]">Rate (AED/kWh)</label>
              <input type="number" id="flat-rate" value={electricityRate} onChange={(e) => setElectricityRate(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 border border-gray-300 rounded-md" step="0.01" />
            </div>
          ) : (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <div className="flex justify-between items-center mb-2"><h3 className="text-sm font-medium text-gray-700">Rate Tiers</h3><button onClick={addTier} className="text-sm p-1 bg-green-600 text-white rounded-full hover:bg-green-700"><PlusCircle size={16} /></button></div>
              <div className="space-y-2">
                {tiers.map((tier, index) => (
                  <div key={index} className="flex items-center gap-1 text-xs">
                    <input type="number" aria-label={`Tier ${index+1} from`} value={tier.from} onChange={(e) => updateTier(index, 'from', e.target.value)} className="w-16 px-1 py-1 border rounded" disabled />
                    <span>-</span>
                    <input type="number" aria-label={`Tier ${index+1} to`} value={tier.to === Infinity ? '' : tier.to} onChange={(e) => updateTier(index, 'to', e.target.value)} className="w-16 px-1 py-1 border rounded" placeholder="∞" disabled={index === tiers.length - 1} />
                    <input type="number" aria-label={`Tier ${index+1} rate`} value={tier.rate} onChange={(e) => updateTier(index, 'rate', e.target.value)} className="w-16 px-1 py-1 border rounded" step="0.01" placeholder="Rate" />
                    <button onClick={() => removeTier(index)} aria-label={`Remove tier ${index + 1}`} className="text-red-500 hover:text-red-700 p-1"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Added Bills Display */}
      {bills.length > 0 && (
        <div className="mt-6">
          <div className="flex justify-between items-center mb-2"><h3 className="text-md font-semibold text-gray-700">Added Bills ({bills.length})</h3><button onClick={() => setBills([])} className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700"><XCircle size={16} />Clear All</button></div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {bills.map((bill, index) => (
              <div key={index} className={`flex justify-between items-center p-2 rounded text-sm ${bill.isEstimated ? 'bg-blue-100' : 'bg-gray-100'}`} title={bill.isEstimated ? 'Estimated' : 'User-provided'}>
                <span>{bill.month.substring(0,3)}: {bill.consumption}</span>
                <div className="flex items-center">{bill.isEstimated && <Wand2 size={12} className="text-blue-500 mr-1" />}<button onClick={() => removeBill(index)} aria-label={`Remove bill for ${bill.month}`} className="text-red-500 hover:text-red-700"><Trash2 size={14} /></button></div>
              </div>
            ))}
          </div>
          {bills.length > 0 && bills.length < 12 && (
            <div className="mt-4 text-center">
              <button onClick={handleEstimateFromPartialData} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2 mx-auto">
                <Wand2 size={16} />Estimate Full Year
              </button>
            </div>
          )}
        </div>
      )}
      {/* Seasonal Analysis Cards */}
      {bills.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mt-6 p-4 rounded-lg bg-[#f8f4e6]">
          {[
            { key: 'Daily Avg', value: `${seasonalAnalysis.dailyAvg} kWh` },
            { key: 'Summer Avg', value: `${seasonalAnalysis.summerAvg} kWh` },
            { key: 'Winter Avg', value: `${seasonalAnalysis.winterAvg} kWh` },
            { key: 'Summer Spike', value: `${seasonalAnalysis.spikePercentage}%`, color: 'text-[#fac65b]' },
            { key: 'Base Load', value: `${seasonalAnalysis.baseLoad} kWh` },
            { key: 'Cooling Load', value: `${seasonalAnalysis.coolingLoad} kWh` },
          ].map(({ key, value, color }) => (
            <div key={key}><p className="text-sm text-[#2c2b88]">{key}</p><p className={`text-xl font-semibold ${color || 'text-[#2c2b88]'}`}>{value}</p></div>
          ))}
        </div>
      )}
    </div>
  );

  const renderSystemParams = () => (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4 text-[#2c2b88]">System Parameters</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {authority === 'FEWA' && !batteryEnabled && (
                <div>
                    <label htmlFor="daytime-use" className="block text-sm font-medium mb-1 text-[#2c2b88]">Daytime Use (%)</label>
                    <input type="number" id="daytime-use" value={daytimeConsumption} onChange={(e) => setDaytimeConsumption(parseInt(e.target.value) || 0)} className="w-full px-3 py-2 border rounded-md" min="0" max="100" />
                </div>
            )}
            {[
              { id: 'available-space', label: 'Available Space (m²)', value: availableSpace, setter: setAvailableSpace },
              { id: 'peak-sun-hours', label: 'Peak Sun Hours', value: peakSunHours, setter: setPeakSunHours, step: 0.1 },
              { id: 'system-efficiency', label: 'System Efficiency (%)', value: systemEfficiency, setter: setSystemEfficiency },
              { id: 'panel-wattage', label: 'Panel Wattage (W)', value: panelWattage, setter: setPanelWattage }
            ].map(({ id, label, value, setter, step }) => (
                <div key={id}>
                    <label htmlFor={id} className="block text-sm font-medium mb-1 text-[#2c2b88]">{label}</label>
                    <input type="number" id={id} value={value} onChange={(e) => setter(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 border rounded-md" step={step} />
                </div>
            ))}
        </div>
    </div>
  );

  const renderRecommendation = () => (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
      <h2 className="text-xl font-semibold mb-4 text-[#2c2b88]">Recommended System</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="p-4 rounded-lg text-white bg-[#2c2b88]"><p className="text-sm opacity-90">System Size</p><p className="text-2xl font-bold">{systemRecommendation.systemSize} kW</p></div>
        <div className="p-4 rounded-lg bg-[#fac65b]"><p className="text-sm text-[#2c2b88]"># of Panels</p><p className="text-2xl font-bold text-[#2c2b88]">{systemRecommendation.panelCount}</p></div>
        <div className="p-4 rounded-lg text-white bg-[#2c2b88]"><p className="text-sm opacity-90">Space Required</p><p className="text-2xl font-bold">{systemRecommendation.spaceRequired} m²</p></div>
        <div className="p-4 rounded-lg bg-[#fac65b]"><p className="text-sm text-[#2c2b88]">Annual Output</p><p className="text-2xl font-bold text-[#2c2b88]">{systemRecommendation.annualProduction.toLocaleString()} kWh</p></div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div><p className="text-sm text-gray-600">Inverter Capacity</p><p className="text-xl font-semibold text-[#2c2b88]">{systemRecommendation.inverterCapacity} kW</p></div>
        {batteryEnabled && authority === 'FEWA' && (<div><p className="text-sm text-gray-600">Battery Capacity</p><p className="text-xl font-semibold text-[#2c2b88]">{systemRecommendation.batteryCapacity} kWh</p></div>)}
      </div>
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3 text-[#2c2b88]">Seasonal Coverage Analysis</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {label: 'Summer', value: systemRecommendation.summerCoverage, color: 'bg-[#fac65b]'},
              {label: 'Winter', value: systemRecommendation.winterCoverage, color: 'bg-[#2c2b88]'},
              {label: 'Annual', value: systemRecommendation.annualCoverage, color: 'bg-green-500'}
            ].map(item => (
              <div key={item.label}><p className="text-sm text-gray-600">{item.label} Coverage</p><div className="w-full bg-gray-200 rounded-full h-4 mt-1"><div className={`h-4 rounded-full ${item.color}`} style={{width: `${item.value}%`}}></div></div><p className="text-sm font-semibold mt-1 text-[#2c2b88]">{item.value}%</p></div>
            ))}
        </div>
      </div>
      {systemRecommendation.spaceRequired > availableSpace && (<div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2"><AlertCircle className="w-5 h-5 text-red-500" /><p className="text-red-700">Warning: Required space ({systemRecommendation.spaceRequired} m²) exceeds available space ({availableSpace} m²)</p></div>)}
    </div>
  );
  
  const renderFinancials = () => (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
      <h2 className="text-xl font-semibold mb-4 text-[#2c2b88]">Financial & ROI Analysis</h2>
      <div className="mb-6">
          <label htmlFor="system-cost" className="block text-sm font-medium text-gray-700 mb-1">System Cost (AED)</label>
          <input type="number" id="system-cost" value={systemCost} onChange={(e) => setSystemCost(e.target.value)} className="w-full max-w-xs px-3 py-2 border rounded-md" placeholder="e.g. 25000" />
      </div>
      {systemCost && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-green-50 p-4 rounded-lg"><p className="text-sm text-gray-600">1st Year Savings</p><p className="text-2xl font-bold text-green-600">AED {financialAnalysis.annualSavings.toLocaleString()}</p></div>
            <div className="bg-blue-50 p-4 rounded-lg"><p className="text-sm text-gray-600">Payback Period</p><p className="text-2xl font-bold text-blue-600">{financialAnalysis.paybackPeriod > 0 ? `${financialAnalysis.paybackPeriod} years` : 'N/A'}</p></div>
            <div className="bg-purple-50 p-4 rounded-lg"><p className="text-sm text-gray-600">25-Year Profit</p><p className="text-2xl font-bold text-purple-600">AED {financialAnalysis.roi25Year.toLocaleString()}</p></div>
            <div className="bg-yellow-50 p-4 rounded-lg"><p className="text-sm text-gray-600">25-Year ROI</p><p className="text-2xl font-bold text-yellow-600">{financialAnalysis.roiPercentage > 0 ? `${financialAnalysis.roiPercentage.toLocaleString()}%` : 'N/A'}</p></div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h4 className="font-semibold text-blue-800 mb-2">What is 25-Year Net Profit?</h4>
            <p className="text-sm text-blue-700">This is your total estimated profit over 25 years after subtracting the system's initial cost and an estimated 1% annual maintenance fee. It represents the total financial benefit of your investment, accounting for panel degradation and grid electricity price increases.</p>
          </div>
          {authority === 'DEWA' && financialAnalysis.netMeteringCredits > 0 && (<div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6"><h4 className="font-semibold text-green-800 mb-2">Net Metering Benefits</h4><p className="text-sm text-green-700">Your system is projected to generate AED {financialAnalysis.netMeteringCredits.toLocaleString()} in excess credits in the first year, which will roll over to offset future bills.</p></div>)}
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-3 text-[#2c2b88]">Monthly Consumption vs. Production</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={MONTHS.map(m => ({month: m.substring(0,3), consumption: bills.find(b=>b.month===m)?.consumption||0, production: Math.round(systemRecommendation.annualProduction/12)}))} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip /><Legend /><Bar dataKey="consumption" fill="#ef4444" name="Consumption (kWh)" /><Bar dataKey="production" fill="#10b981" name="Production (kWh)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );

  const renderExportSave = () => {
    const reportData = { projectName: projectName || 'Solar Project', location, authority, batteryEnabled, seasonalAnalysis, systemRecommendation, financialAnalysis, systemCost };
    const summary = `SOLAR OASIS - PROJECT REPORT\n============================\nProject: ${reportData.projectName}\nLocation: ${reportData.location}\nAuthority: ${reportData.authority}\nDate: ${new Date().toLocaleDateString()}\n\nCONSUMPTION ANALYSIS\n--------------------\nSummer Average: ${reportData.seasonalAnalysis.summerAvg} kWh/month\nWinter Average: ${reportData.seasonalAnalysis.winterAvg} kWh/month\nSummer Spike: ${reportData.seasonalAnalysis.spikePercentage}%\n\nRECOMMENDED SYSTEM\n------------------\nSystem Size: ${reportData.systemRecommendation.systemSize} kW\nNumber of Panels: ${reportData.systemRecommendation.panelCount}\nAnnual Production: ${reportData.systemRecommendation.annualProduction.toLocaleString()} kWh\n${reportData.batteryEnabled ? `Battery Capacity: ${reportData.systemRecommendation.batteryCapacity} kWh\n` : ''}\nFINANCIAL ANALYSIS\n------------------\nSystem Cost: AED ${parseInt(reportData.systemCost || '0').toLocaleString()}\nFirst-Year Savings: AED ${reportData.financialAnalysis.annualSavings.toLocaleString()}\nPayback Period: ${reportData.financialAnalysis.paybackPeriod} years\n25-Year Net Profit: AED ${reportData.financialAnalysis.roi25Year.toLocaleString()}\n25-Year ROI: ${reportData.financialAnalysis.roiPercentage.toLocaleString()}%`;
    const projectDataStr = JSON.stringify({ projectName, location, authority, batteryEnabled, bills, rateStructure, electricityRate, tiers, daytimeConsumption, availableSpace, peakSunHours, systemEfficiency, panelWattage, systemCost }, null, 2);

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target?.result as string);
                setProjectName(data.projectName || ''); setLocation(data.location || 'Dubai, UAE'); setAuthority(data.authority || 'DEWA'); setBatteryEnabled(data.batteryEnabled || false); setBills(data.bills || []); setRateStructure(data.rateStructure || 'flat'); setElectricityRate(data.electricityRate || 0.5); setTiers(data.tiers || []); setDaytimeConsumption(data.daytimeConsumption || 60); setAvailableSpace(data.availableSpace || 100); setPeakSunHours(data.peakSunHours || 5.5); setSystemEfficiency(data.systemEfficiency || 85); setPanelWattage(data.panelWattage || 550); setSystemCost(data.systemCost || '');
            } catch (error) { alert("Error: Could not load the project file."); }
        };
        reader.readAsText(file);
    };

    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-semibold mb-4 text-[#2c2b88]">Export & Save</h2>
        <div className="flex flex-col sm:flex-row gap-4">
          <button onClick={() => navigator.clipboard.writeText(summary).then(() => alert('Report copied!'))} className="flex items-center justify-center gap-2 px-6 py-3 bg-[#2c2b88] text-white font-semibold rounded-md hover:bg-opacity-90 w-full sm:w-auto"><FileText className="w-5 h-5" /> Copy Report</button>
          <button onClick={() => { const link = document.createElement("a"); link.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(projectDataStr); link.download = `${(projectName || 'solar_project').replace(/\s/g, '_')}.json`; link.click(); }} className="flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700 w-full sm:w-auto"><Download className="w-5 h-5" /> Save Project</button>
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-500 text-white font-semibold rounded-md hover:bg-gray-600 w-full sm:w-auto"><Upload className="w-5 h-5" /> Load Project</button>
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".json" className="hidden" />
        </div>
      </div>
    );
  }

  // === MAIN RENDER ===
  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      {renderHeader()}
      <main className="max-w-7xl mx-auto px-6 pb-12">
        {renderProjectConfig()}
        {renderBillAnalysis()}
        {renderSystemParams()}
        {bills.length > 0 && renderRecommendation()}
        {bills.length > 0 && renderFinancials()}
        {bills.length > 0 && systemCost && renderExportSave()}
      </main>
    </div>
  );
};

export default App;