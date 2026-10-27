class Quota {
  const Quota({
    required this.limit,
    required this.used,
    required this.reserved,
    required this.remaining,
  });

  final int limit;
  final int used;
  final int reserved;
  final int remaining;

  factory Quota.fromJson(Map<String, dynamic> json) => Quota(
        limit: (json['limit'] as num?)?.toInt() ?? 10,
        used: (json['used'] as num?)?.toInt() ?? 0,
        reserved: (json['reserved'] as num?)?.toInt() ?? 0,
        remaining: (json['remaining'] as num?)?.toInt() ?? 10,
      );
}
