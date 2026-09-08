export const roundUpTo = (value: number, step: number) =>
  Math.ceil(value / step) * step;

export const roundDownTo = (value: number, step: number) =>
  Math.floor(value / step) * step;

export const scaleLinearY = ({
  value,
  minValue,
  range,
  top,
  bottom,
}: {
  value: number;
  minValue: number;
  range: number;
  top: number;
  bottom: number;
}) => bottom - ((value - minValue) / range) * (bottom - top);
