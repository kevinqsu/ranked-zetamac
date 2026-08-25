module.exports = {
  purge: {
    enabled: true,
    content: ["./public/index.html", "./public/game.js"],
    options: {
      // These color classes are assembled dynamically by the difficulty picker.
      safelist: [
        "bg-green-50",
        "bg-green-100",
        "bg-yellow-50",
        "bg-yellow-100",
        "bg-red-50",
        "bg-red-100",
        "ring-2",
        "ring-green-400",
        "ring-yellow-400",
        "ring-red-400",
        "text-green-700",
        "text-yellow-700",
        "text-red-700",
      ],
    },
  },
  theme: {
    extend: {},
  },
  variants: {},
  plugins: [],
};
