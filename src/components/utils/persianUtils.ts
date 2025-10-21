// Utility functions for Persian formatting
export const toPersianDigits = (input: string | number): string => {
  if (input === null || input === undefined) return '';
  
  const str = input.toString();
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  
  return str.replace(/[0-9]/g, (digit) => persianDigits[parseInt(digit)]);
};

export const toEnglishDigits = (input: string): string => {
  if (!input) return '';
  
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const englishDigits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  
  let result = input;
  persianDigits.forEach((persian, index) => {
    result = result.replace(new RegExp(persian, 'g'), englishDigits[index]);
  });
  
  return result;
};

export const formatPersianNumber = (num: number): string => {
  return toPersianDigits(new Intl.NumberFormat('fa-IR').format(num));
};

export const formatPersianTime = (time: string): string => {
  return toPersianDigits(time);
};