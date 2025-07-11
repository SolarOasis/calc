import React, { useState, useEffect, useCallback } from 'react';
import { Sun, Battery, TrendingUp, FileText, AlertCircle, Trash2, PlusCircle, Download, XCircle, Wand2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Bill, Tier, SeasonalAnalysis, SystemRecommendation, FinancialAnalysis } from './types';

const UAE_SEASONAL_FACTORS: { [key: string]: number } = {
  'January': 0.75, 'February': 0.70, 'March': 0.80, 'April': 0.95,
  'May': 1.15, 'June': 1.35, 'July': 1.50, 'August': 1.45,
  'September': 1.25, 'October': 1.05, 'November': 0.85, 'December': 0.80,
};

const App: React.FC = () => {
  // Project Configuration
  const [authority, setAuthority] = useState<string>('DEWA');
  const [batteryEnabled, setBatteryEnabled] = useState<boolean>(false);
  const [projectName, setProjectName] = useState<string>('');
  const [location, setLocation] = useState<string>('Dubai, UAE');

  // Bill Inputs
  const [bills, setBills] = useState<Bill[]>([]);
  const [billInput, setBillInput] = useState<string>('');
  const [rateStructure, setRateStructure] = useState<string>('flat'); // 'flat' or 'tiered'
  const [electricityRate, setElectricityRate] = useState<number>(0.5); // AED per kWh for flat rate
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

  // ROI Inputs
  const [systemCost, setSystemCost] = useState<string>('');

  // Calculated Values
  const [seasonalAnalysis, setSeasonalAnalysis] = useState<SeasonalAnalysis>({
    summerAvg: 0, winterAvg: 0, spikePercentage: 0, baseLoad: 0, coolingLoad: 0
  });
  const [systemRecommendation, setSystemRecommendation] = useState<SystemRecommendation>({
    systemSize: 0, panelCount: 0, spaceRequired: 0, annualProduction: 0, inverterCapacity: 0,
    batteryCapacity: 0, summerCoverage: 0, winterCoverage: 0, annualCoverage: 0
  });
  const [financialAnalysis, setFinancialAnalysis] = useState<FinancialAnalysis>({
    annualSavings: 0, paybackPeriod: 0, roi25Year: 0, netMeteringCredits: 0
  });

  const months: string[] = ['January', 'February', 'March', 'April', 'May', 'June', 
                  'July', 'August', 'September', 'October', 'November', 'December'];

  const calculateBillAmount = useCallback((consumption: number): number => {
    if (consumption <= 0) return 0;
    if (rateStructure === 'flat') {
      return consumption * electricityRate;
    } else {
      let totalAmount = 0;
      let remainingConsumption = consumption;
      for (const tier of tiers) {
        if (remainingConsumption <= 0) break;
        const tierStart = tier.from > 0 ? tier.from -1 : 0;
        const tierConsumption = tier.to === Infinity 
          ? remainingConsumption 
          : Math.min(remainingConsumption, tier.to - tierStart);
        
        totalAmount += Math.max(0, tierConsumption) * tier.rate;
        remainingConsumption -= tierConsumption;
      }
      return totalAmount;
    }
  }, [rateStructure, electricityRate, tiers]);
  
  const getAverageRate = useCallback((consumption: number): number => {
    if (consumption === 0) return rateStructure === 'flat' ? electricityRate : tiers[0]?.rate || 0;
    if (rateStructure === 'flat') return electricityRate;
    return calculateBillAmount(consumption) / consumption;
  }, [rateStructure, electricityRate, tiers, calculateBillAmount]);

  const addTier = () => {
    const lastTier = tiers[tiers.length - 1];
    const newFrom = lastTier.to === Infinity ? (lastTier.from + 2000) : (lastTier.to + 1);
    setTiers([...tiers.slice(0, -1), 
      { from: lastTier.from, to: newFrom - 1, rate: lastTier.rate },
      { from: newFrom, to: Infinity, rate: parseFloat((lastTier.rate + 0.05).toFixed(2)) }
    ]);
  };

  const updateTier = (index: number, field: keyof Tier, value: string) => {
    const newTiers = [...tiers];
    const numValue = field === 'rate' ? parseFloat(value) : parseInt(value, 10);
    
    if (field === 'to' && index < tiers.length - 1) {
      newTiers[index + 1].from = numValue + 1;
    }
    (newTiers[index] as any)[field] = numValue;
    setTiers(newTiers);
  };
  
  const removeTier = (index: number) => {
    if (tiers.length > 1) {
      const newTiers = tiers.filter((_, i) => i !== index);
      if(newTiers.length > 0 && index > 0 && newTiers[index-1]) {
        newTiers[index-1].to = Infinity;
      }
      setTiers(newTiers);
    }
  };

  const parseBillInput = useCallback((input: string): Bill[] => {
    const entries = input.split(/[,;\n]+/).filter(e => e.trim());
    const newBills: Bill[] = [];
    const existingMonths = new Set(bills.map(b => b.month));
    entries.forEach(entry => {
      const match = entry.trim().match(/^(\w+)[\s-]*(\d+)$/);
      if (match) {
        const [_, monthStr, consumptionStr] = match;
        const consumption = parseFloat(consumptionStr);
        const monthLower = monthStr.toLowerCase();
        
        const monthIndex = months.findIndex(m => m.toLowerCase().startsWith(monthLower));
        if (monthIndex !== -1) {
          const month = months[monthIndex];
          if (month && consumption > 0 && !existingMonths.has(month)) {
            newBills.push({
              month,
              consumption,
              amount: calculateBillAmount(consumption),
              isEstimated: false
            });
            existingMonths.add(month);
          }
        }
      }
    });
    return newBills;
  }, [calculateBillAmount, bills, months]);

  const addBills = useCallback(() => {
    const newBills = parseBillInput(billInput);
    if (newBills.length > 0) {
      setBills(prevBills => [...prevBills, ...newBills].filter((bill, index, self) => 
        index === self.findIndex((b) => b.month === bill.month)
      ).sort((a,b) => months.indexOf(a.month) - months.indexOf(b.month)));
      setBillInput('');
    }
  }, [billInput, parseBillInput, months]);

  const removeBill = (index: number) => {
    setBills(bills.filter((_, i) => i !== index));
  };
  
  const handleBillInputKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      addBills();
    }
  };

  const handleEstimateFromPartialData = useCallback(() => {
    if (bills.length === 0 || bills.length >= 12) return;

    const totalBaseConsumption = bills.reduce((sum, bill) => {
      return sum + (bill.consumption / UAE_SEASONAL_FACTORS[bill.month]);
    }, 0);
    const normalizedAvgConsumption = totalBaseConsumption / bills.length;

    const userProvidedMonths = new Set(bills.map(b => b.month));

    const estimatedBills = months
      .filter(month => !userProvidedMonths.has(month))
      .map(month => {
        const estimatedConsumption = Math.round(normalizedAvgConsumption * UAE_SEASONAL_FACTORS[month]);
        return {
          month,
          consumption: estimatedConsumption,
          amount: calculateBillAmount(estimatedConsumption),
          isEstimated: true,
        };
      });

    const fullYearBills = [...bills.map(b => ({ ...b, isEstimated: false })), ...estimatedBills]
      .sort((a, b) => months.indexOf(a.month) - months.indexOf(b.month));
    
    setBills(fullYearBills);
  }, [bills, calculateBillAmount, months]);

  useEffect(() => {
    if (bills.length > 0) {
      const summerMonths = ['May', 'June', 'July', 'August', 'September'];
      const winterMonths = ['October', 'November', 'December', 'January', 'February', 'March', 'April'];
      const summerBills = bills.filter(bill => summerMonths.includes(bill.month));
      const winterBills = bills.filter(bill => winterMonths.includes(bill.month));
      const summerAvg = summerBills.length > 0 ? summerBills.reduce((sum, bill) => sum + bill.consumption, 0) / summerBills.length : 0;
      const winterAvg = winterBills.length > 0 ? winterBills.reduce((sum, bill) => sum + bill.consumption, 0) / winterBills.length : 0;
      const spikePercentage = winterAvg > 0 ? ((summerAvg - winterAvg) / winterAvg) * 100 : 0;
      setSeasonalAnalysis({
        summerAvg: Math.round(summerAvg), winterAvg: Math.round(winterAvg),
        spikePercentage: Math.round(spikePercentage), baseLoad: Math.round(winterAvg),
        coolingLoad: Math.round(summerAvg - winterAvg)
      });
    } else {
        setSeasonalAnalysis({ summerAvg: 0, winterAvg: 0, spikePercentage: 0, baseLoad: 0, coolingLoad: 0 });
    }
  }, [bills]);

  useEffect(() => {
    if (bills.length > 0) {
      const avgMonthlyConsumption = bills.reduce((sum, bill) => sum + bill.consumption, 0) / bills.length;
      const avgDailyConsumption = avgMonthlyConsumption / 30;
      let targetConsumption = avgDailyConsumption;
      
      if (authority === 'FEWA' && !batteryEnabled) {
        targetConsumption = avgDailyConsumption * (daytimeConsumption / 100);
      }
      
      const systemSize = (targetConsumption / (peakSunHours * (systemEfficiency / 100)));
      const panelCount = Math.ceil((systemSize * 1000) / panelWattage);
      const actualSystemSize = (panelCount * panelWattage) / 1000;
      const spaceRequired = panelCount * 2.1;
      const annualProduction = actualSystemSize * peakSunHours * 365 * (systemEfficiency / 100);
      const inverterCapacity = Math.ceil(actualSystemSize * 1.1 * 10) / 10;
      
      let batteryCapacity = 0;
      if (authority === 'FEWA' && batteryEnabled) {
        const nightConsumption = avgDailyConsumption * (1 - daytimeConsumption / 100);
        batteryCapacity = Math.ceil(nightConsumption * 1.2);
      }
      
      const monthlyProduction = annualProduction / 12;
      const summerCoverage = seasonalAnalysis.summerAvg > 0 ? (monthlyProduction / seasonalAnalysis.summerAvg) * 100 : 100;
      const winterCoverage = seasonalAnalysis.winterAvg > 0 ? (monthlyProduction / seasonalAnalysis.winterAvg) * 100 : 100;
      const annualCoverage = avgMonthlyConsumption > 0 ? (annualProduction / (avgMonthlyConsumption * 12)) * 100 : 100;
      
      setSystemRecommendation({
        systemSize: Math.round(actualSystemSize * 10) / 10, panelCount,
        spaceRequired: Math.round(spaceRequired), annualProduction: Math.round(annualProduction),
        inverterCapacity, batteryCapacity,
        summerCoverage: Math.min(Math.round(summerCoverage), 100),
        winterCoverage: Math.min(Math.round(winterCoverage), 100),
        annualCoverage: Math.min(Math.round(annualCoverage), 100)
      });
    } else {
        setSystemRecommendation({ systemSize: 0, panelCount: 0, spaceRequired: 0, annualProduction: 0, inverterCapacity: 0, batteryCapacity: 0, summerCoverage: 0, winterCoverage: 0, annualCoverage: 0 });
    }
  }, [bills, authority, batteryEnabled, daytimeConsumption, peakSunHours, systemEfficiency, panelWattage, seasonalAnalysis.summerAvg, seasonalAnalysis.winterAvg]);

  const calculateBillAmountWithEscalation = useCallback((consumption: number, year: number, escalation: number): number => {
    if (consumption <= 0) return 0;
    const escalationFactor = Math.pow(1 + escalation, year - 1);

    if (rateStructure === 'flat') {
      return consumption * (electricityRate * escalationFactor);
    } else {
      let totalAmount = 0;
      let remainingConsumption = consumption;
      for (const tier of tiers) {
        if (remainingConsumption <= 0) break;
        const tierStart = tier.from > 0 ? tier.from -1 : 0;
        const tierConsumption = tier.to === Infinity 
          ? remainingConsumption 
          : Math.min(remainingConsumption, tier.to - tierStart);
        
        totalAmount += Math.max(0, tierConsumption) * (tier.rate * escalationFactor);
        remainingConsumption -= tierConsumption;
      }
      return totalAmount;
    }
  }, [rateStructure, electricityRate, tiers]);

  useEffect(() => {
    if (!systemCost || bills.length === 0 || systemRecommendation.annualProduction === 0) {
      setFinancialAnalysis({ annualSavings: 0, paybackPeriod: 0, roi25Year: 0, netMeteringCredits: 0 });
      return;
    }

    const DEGRADATION_RATE = 0.005; // 0.5% per year
    const ELECTRICITY_ESCALATION = 0.02; // 2% per year
    const SYSTEM_LIFESPAN_YEARS = 25;
    
    const initialInvestment = parseFloat(systemCost);
    const maintenanceCostPerYear = initialInvestment * 0.01;

    const avgMonthlyConsumption = bills.reduce((sum, bill) => sum + bill.consumption, 0) / bills.length;
    const consumptionByMonth = months.reduce((acc, month) => {
        const bill = bills.find(b => b.month === month);
        acc[month] = bill ? bill.consumption : avgMonthlyConsumption;
        return acc;
    }, {} as {[key: string]: number});

    let cumulativeCashFlow = -initialInvestment;
    let paybackPeriodYears = 0;
    let firstYearAnnualSavings = 0;
    let netMeteringCreditsKwh = 0; // For DEWA rollover

    for (let year = 1; year <= SYSTEM_LIFESPAN_YEARS; year++) {
      let yearlySavings = 0;
      const degradationFactor = Math.pow(1 - DEGRADATION_RATE, year - 1);

      for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
          const monthName = months[monthIndex];
          const monthlyConsumption = consumptionByMonth[monthName];
          const monthlyProduction = (systemRecommendation.annualProduction / 12) * degradationFactor;

          const originalBill = calculateBillAmountWithEscalation(monthlyConsumption, year, ELECTRICITY_ESCALATION);
          let newBill = 0;

          if (authority === 'DEWA') {
              const netKwh = monthlyProduction - monthlyConsumption;
              if (netKwh >= 0) { // Excess production
                  netMeteringCreditsKwh += netKwh;
                  newBill = 0;
              } else { // Grid consumption
                  const kwhToDraw = Math.abs(netKwh);
                  const drawnFromCredits = Math.min(kwhToDraw, netMeteringCreditsKwh);
                  netMeteringCreditsKwh -= drawnFromCredits;
                  const kwhToBill = kwhToDraw - drawnFromCredits;
                  newBill = calculateBillAmountWithEscalation(kwhToBill, year, ELECTRICITY_ESCALATION);
              }
          } else { // FEWA
              const selfConsumptionRate = batteryEnabled ? 0.95 : (daytimeConsumption / 100);
              const savedKwh = Math.min(monthlyProduction * selfConsumptionRate, monthlyConsumption);
              newBill = calculateBillAmountWithEscalation(monthlyConsumption - savedKwh, year, ELECTRICITY_ESCALATION);
          }
          
          yearlySavings += (originalBill - newBill);
      }
      
      if (year === 1) {
          firstYearAnnualSavings = yearlySavings;
      }
      
      const yearlyCashFlow = yearlySavings - maintenanceCostPerYear;
      const prevCumulativeCashFlow = cumulativeCashFlow;
      cumulativeCashFlow += yearlyCashFlow;

      if (paybackPeriodYears === 0 && cumulativeCashFlow > 0) {
          const fractionOfYear = Math.abs(prevCumulativeCashFlow) / yearlyCashFlow;
          paybackPeriodYears = (year - 1) + fractionOfYear;
      }
    }
    
    const avgTariff = getAverageRate(avgMonthlyConsumption);
    const totalAnnualConsumption = avgMonthlyConsumption * 12;
    const excessProduction = Math.max(0, systemRecommendation.annualProduction - totalAnnualConsumption);
    const netMeteringCreditsValue = excessProduction * avgTariff;

    setFinancialAnalysis({
      annualSavings: Math.round(firstYearAnnualSavings),
      paybackPeriod: paybackPeriodYears > 0 ? Math.round(paybackPeriodYears * 10) / 10 : 0,
      roi25Year: Math.round(cumulativeCashFlow + initialInvestment),
      netMeteringCredits: Math.round(netMeteringCreditsValue)
    });
  }, [systemCost, bills, systemRecommendation, authority, batteryEnabled, daytimeConsumption, getAverageRate, calculateBillAmountWithEscalation]);


  const generateMonthlyData = () => {
    return months.map(month => {
      const bill = bills.find(b => b.month === month);
      const consumption = bill ? bill.consumption : 0;
      const monthlyProduction = systemRecommendation.annualProduction / 12;
      return {
        month: month.substring(0, 3), consumption,
        production: Math.round(monthlyProduction)
      };
    });
  };

  const copyReport = () => {
    const reportData = { projectName: projectName || 'Solar Project', location, authority, batteryEnabled, seasonalAnalysis, systemRecommendation, financialAnalysis, systemCost };
    const summary = `
SOLAR OASIS - PROJECT REPORT
============================
Project: ${reportData.projectName}
Location: ${reportData.location}
Authority: ${reportData.authority}
Date: ${new Date().toLocaleDateString()}
CONSUMPTION ANALYSIS
--------------------
Summer Average: ${reportData.seasonalAnalysis.summerAvg} kWh/month
Winter Average: ${reportData.seasonalAnalysis.winterAvg} kWh/month
Summer Spike: ${reportData.seasonalAnalysis.spikePercentage}%
RECOMMENDED SYSTEM
------------------
System Size: ${reportData.systemRecommendation.systemSize} kW
Number of Panels: ${reportData.systemRecommendation.panelCount}
Annual Production: ${reportData.systemRecommendation.annualProduction.toLocaleString()} kWh
${reportData.batteryEnabled ? `Battery Capacity: ${reportData.systemRecommendation.batteryCapacity} kWh` : ''}
FINANCIAL ANALYSIS
------------------
System Cost: AED ${parseInt(reportData.systemCost).toLocaleString()}
First-Year Savings: AED ${reportData.financialAnalysis.annualSavings.toLocaleString()}
Payback Period: ${reportData.financialAnalysis.paybackPeriod} years
25-Year Net Profit: AED ${reportData.financialAnalysis.roi25Year.toLocaleString()}
    `.trim();
    navigator.clipboard.writeText(summary).then(() => alert('Report copied to clipboard!'));
  };

  const saveProject = () => {
    const projectData = { projectName, location, authority, batteryEnabled, bills, rateStructure, electricityRate, tiers, daytimeConsumption, availableSpace, peakSunHours, systemEfficiency, panelWattage, systemCost };
    const dataStr = JSON.stringify(projectData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `${projectName.replace(/\s/g, '_') || 'solar_project'}_${new Date().toISOString().split('T')[0]}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const systemParameterInputs = [
    { label: 'Available Space (m²)', value: availableSpace, setter: setAvailableSpace, step: undefined },
    { label: 'Peak Sun Hours', value: peakSunHours, setter: setPeakSunHours, step: 0.1 },
    { label: 'System Efficiency (%)', value: systemEfficiency, setter: setSystemEfficiency, step: undefined },
    { label: 'Panel Wattage (W)', value: panelWattage, setter: setPanelWattage, step: undefined }
  ];

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
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

      <main className="max-w-7xl mx-auto px-6 pb-12">
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
              <label className="block text-sm font-medium mb-1 text-[#2c2b88]">Project Name</label>
              <input type="text" value={projectName} onChange={(e) => setProjectName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2c2b88] focus:border-transparent" placeholder="e.g. Villa Solar Project" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-[#2c2b88]">Location</label>
              <input type="text" value={location} onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2c2b88] focus:border-transparent" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-[#2c2b88]">Electricity Bill Analysis</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1 text-[#2c2b88]">Quick Bill Entry</label>
              <textarea value={billInput} onChange={(e) => setBillInput(e.target.value)} onKeyPress={handleBillInputKeyPress}
                className="w-full px-3 py-2 border border-gray-300 rounded-md h-28 focus:outline-none focus:ring-2 focus:ring-[#2c2b88] focus:border-transparent"
                placeholder="Enter bills like:&#10;Jan-2000&#10;Feb-2100&#10;&#10;Or comma-separated: Mar-1950, Apr-1980" />
              <button onClick={addBills} className="mt-2 w-full px-4 py-2 text-white font-semibold rounded-md transition-colors bg-[#fac65b] hover:bg-[#f9b842] text-[#2c2b88]">
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
                  <label className="block text-xs font-medium mb-1 text-[#2c2b88]">Rate (AED/kWh)</label>
                  <input type="number" value={electricityRate} onChange={(e) => setElectricityRate(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2c2b88] focus:border-transparent" step="0.01" />
                </div>
              ) : (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-sm font-medium text-gray-700">Rate Tiers</h3>
                    <button onClick={addTier} className="text-sm p-1 bg-green-600 text-white rounded-full hover:bg-green-700"><PlusCircle size={16} /></button>
                  </div>
                  <div className="space-y-2">
                    {tiers.map((tier, index) => (
                      <div key={index} className="flex items-center gap-1 text-xs">
                        <input type="number" value={tier.from} onChange={(e) => updateTier(index, 'from', e.target.value)} className="w-16 px-1 py-1 border rounded" disabled={index === 0} />
                        <span>-</span>
                        <input type="number" value={tier.to === Infinity ? '' : tier.to} onChange={(e) => updateTier(index, 'to', e.target.value)} className="w-16 px-1 py-1 border rounded" placeholder={tier.to === Infinity ? '∞' : 'To'} disabled={index === tiers.length - 1} />
                        <input type="number" value={tier.rate} onChange={(e) => updateTier(index, 'rate', e.target.value)} className="w-16 px-1 py-1 border rounded" step="0.01" placeholder="Rate" />
                        <button onClick={() => removeTier(index)} className="text-red-500 hover:text-red-700 p-1"><Trash2 size={14} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {bills.length > 0 && (
            <div className="mt-6">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-md font-semibold text-gray-700">Added Bills ({bills.length})</h3>
                <button onClick={() => setBills([])} className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700">
                    <XCircle size={16} />
                    Clear All
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {bills.map((bill, index) => (
                  <div key={index} className={`flex justify-between items-center p-2 rounded text-sm ${bill.isEstimated ? 'bg-blue-100' : 'bg-gray-100'}`} title={bill.isEstimated ? 'Estimated value' : 'User-provided value'}>
                    <span>{bill.month.substring(0,3)}: {bill.consumption}</span>
                    <div className="flex items-center">
                        {bill.isEstimated && <Wand2 size={12} className="text-blue-500 mr-1" />}
                        <button onClick={() => removeBill(index)} className="text-red-500 hover:text-red-700"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
              {bills.length > 0 && bills.length < 12 && (
                <div className="mt-4 text-center">
                    <button onClick={handleEstimateFromPartialData} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2 mx-auto">
                        <Wand2 size={16} />
                        Estimate Full Year from {bills.length} Bill{bills.length > 1 ? 's' : ''}
                    </button>
                </div>
              )}
            </div>
          )}
          {bills.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6 p-4 rounded-lg bg-[#f8f4e6]">
              {Object.entries({ 'Summer Avg': `${seasonalAnalysis.summerAvg} kWh`, 'Winter Avg': `${seasonalAnalysis.winterAvg} kWh`, 'Summer Spike': `${seasonalAnalysis.spikePercentage}%`, 'Base Load': `${seasonalAnalysis.baseLoad} kWh`, 'Cooling Load': `${seasonalAnalysis.coolingLoad} kWh` }).map(([key, value]) => (
                <div key={key}>
                  <p className="text-sm text-[#2c2b88]">{key}</p>
                  <p className={`text-xl font-semibold ${key === 'Summer Spike' ? 'text-[#fac65b]' : 'text-[#2c2b88]'}`}>{value}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 text-[#2c2b88]">System Parameters</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {authority === 'FEWA' && !batteryEnabled && (
                    <div>
                        <label className="block text-sm font-medium mb-1 text-[#2c2b88]">Daytime Use (%)</label>
                        <input type="number" value={daytimeConsumption} onChange={(e) => setDaytimeConsumption(parseInt(e.target.value))} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2c2b88] focus:border-transparent" min="0" max="100" />
                    </div>
                )}
                {systemParameterInputs.map(({ label, value, setter, step }) => (
                    <div key={label}>
                        <label className="block text-sm font-medium mb-1 text-[#2c2b88]">{label}</label>
                        <input type="number" value={value} onChange={(e) => setter(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2c2b88] focus:border-transparent" step={step} />
                    </div>
                ))}
            </div>
        </div>

        {bills.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 text-[#2c2b88]">Recommended System</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="p-4 rounded-lg text-white bg-[#2c2b88]"><p className="text-sm opacity-90">System Size</p><p className="text-2xl font-bold">{systemRecommendation.systemSize} kW</p></div>
              <div className="p-4 rounded-lg bg-[#fac65b]"><p className="text-sm text-[#2c2b88]">Number of Panels</p><p className="text-2xl font-bold text-[#2c2b88]">{systemRecommendation.panelCount}</p></div>
              <div className="p-4 rounded-lg text-white bg-[#2c2b88]"><p className="text-sm opacity-90">Space Required</p><p className="text-2xl font-bold">{systemRecommendation.spaceRequired} m²</p></div>
              <div className="p-4 rounded-lg bg-[#fac65b]"><p className="text-sm text-[#2c2b88]">Annual Production</p><p className="text-2xl font-bold text-[#2c2b88]">{systemRecommendation.annualProduction.toLocaleString()} kWh</p></div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              <div><p className="text-sm text-gray-600">Inverter Capacity</p><p className="text-xl font-semibold text-[#2c2b88]">{systemRecommendation.inverterCapacity} kW</p></div>
              {batteryEnabled && authority === 'FEWA' && (<div><p className="text-sm text-gray-600">Battery Capacity</p><p className="text-xl font-semibold text-[#2c2b88]">{systemRecommendation.batteryCapacity} kWh</p></div>)}
            </div>
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3 text-[#2c2b88]">Seasonal Coverage Analysis</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div><p className="text-sm text-gray-600">Summer Coverage</p><div className="w-full bg-gray-200 rounded-full h-4 mt-1"><div className="h-4 rounded-full bg-[#fac65b]" style={{width: `${systemRecommendation.summerCoverage}%`}}></div></div><p className="text-sm font-semibold mt-1 text-[#2c2b88]">{systemRecommendation.summerCoverage}%</p></div>
                  <div><p className="text-sm text-gray-600">Winter Coverage</p><div className="w-full bg-gray-200 rounded-full h-4 mt-1"><div className="h-4 rounded-full bg-[#2c2b88]" style={{width: `${systemRecommendation.winterCoverage}%`}}></div></div><p className="text-sm font-semibold mt-1 text-[#2c2b88]">{systemRecommendation.winterCoverage}%</p></div>
                  <div><p className="text-sm text-gray-600">Annual Average</p><div className="w-full bg-gray-200 rounded-full h-4 mt-1"><div className="h-4 rounded-full bg-green-500" style={{width: `${systemRecommendation.annualCoverage}%`}}></div></div><p className="text-sm font-semibold mt-1 text-green-600">{systemRecommendation.annualCoverage}%</p></div>
              </div>
            </div>
            {systemRecommendation.spaceRequired > availableSpace && (<div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2"><AlertCircle className="w-5 h-5 text-red-500" /><p className="text-red-700">Warning: Required space ({systemRecommendation.spaceRequired} m²) exceeds available space ({availableSpace} m²)</p></div>)}
          </div>
        )}

        {bills.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 text-[#2c2b88]">Financial & ROI Analysis</h2>
            <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">System Cost (AED)</label>
                <input type="number" value={systemCost} onChange={(e) => setSystemCost(e.target.value)} className="w-full max-w-xs px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#2c2b88] focus:border-transparent" placeholder="e.g. 25000" />
            </div>
            
            {systemCost && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-green-50 p-4 rounded-lg"><p className="text-sm text-gray-600">First-Year Savings</p><p className="text-2xl font-bold text-green-600">AED {financialAnalysis.annualSavings.toLocaleString()}</p></div>
                  <div className="bg-blue-50 p-4 rounded-lg"><p className="text-sm text-gray-600">Payback Period</p><p className="text-2xl font-bold text-blue-600">{financialAnalysis.paybackPeriod > 0 ? `${financialAnalysis.paybackPeriod} years` : 'N/A'}</p></div>
                  <div className="bg-purple-50 p-4 rounded-lg"><p className="text-sm text-gray-600">25-Year Net Profit</p><p className="text-2xl font-bold text-purple-600">AED {financialAnalysis.roi25Year.toLocaleString()}</p></div>
                </div>
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <h4 className="font-semibold text-blue-800 mb-2">What is 25-Year Net Profit?</h4>
                  <p className="text-sm text-blue-700">
                    This is your total estimated profit over 25 years after subtracting the system's initial cost and an estimated 1% annual maintenance fee. It represents the total financial benefit of your investment, accounting for panel degradation and grid electricity price increases over time.
                  </p>
                </div>

                {authority === 'DEWA' && financialAnalysis.netMeteringCredits > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6"><h4 className="font-semibold text-green-800 mb-2">Net Metering Benefits</h4><p className="text-sm text-green-700">Your system is projected to generate AED {financialAnalysis.netMeteringCredits.toLocaleString()} in excess credits in the first year, which will roll over to offset your future electricity bills.</p></div>
                )}
                
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-3 text-[#2c2b88]">Monthly Consumption vs. Production</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={generateMonthlyData()} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="consumption" fill="#ef4444" name="Consumption (kWh)" />
                      <Bar dataKey="production" fill="#10b981" name="Production (kWh)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </div>
        )}
        
        {bills.length > 0 && systemCost && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-[#2c2b88]">Export & Save</h2>
            <div className="flex flex-col sm:flex-row gap-4">
              <button onClick={copyReport} className="flex items-center justify-center gap-2 px-6 py-3 bg-[#2c2b88] text-white font-semibold rounded-md hover:bg-opacity-90 transition-colors w-full sm:w-auto">
                <FileText className="w-5 h-5" /> Copy Report
              </button>
              <button onClick={saveProject} className="flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700 transition-colors w-full sm:w-auto">
                <Download className="w-5 h-5" /> Save Project
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
